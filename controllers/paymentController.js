const Order = require('../models/Order');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const Quiz = require('../models/Quiz');

// Initialize Razorpay
let razorpay;
try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  } else {
    console.warn('Razorpay keys not configured. Payment features will be disabled.');
  }
} catch (error) {
  console.error('Failed to initialize Razorpay:', error.message);
}

const getRazorpayKey = (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID) {
      console.error('Razorpay Key ID is not set in environment variables.');
      return res.status(500).json({ success: false, message: 'Payment provider key is not configured.' });
    }
    res.json({ keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    console.error('Get Razorpay key error:', error);
    res.status(500).json({ success: false, message: 'Could not get Razorpay key' });
  }
};

const createOrder = async (req, res) => {
  try {
    const { quizId } = req.body;
    const userId = req.user._id;

    if (!quizId) {
      return res.status(400).json({
        success: false,
        message: 'Quiz ID is required'
      });
    }

    // Fetch the quiz to get price and details
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    if (quiz.quizType !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This quiz is not a paid quiz'
      });
    }

    // Check if user is already registered
    const isAlreadyRegistered = quiz.participants.some(p => p.userId.toString() === userId.toString());
    if (isAlreadyRegistered) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this quiz'
      });
    }

    // Generate unique order ID
    const orderId = 'ORD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Create Razorpay order first
    const razorpayOrder = await razorpay.orders.create({
      amount: quiz.price * 100, // Convert to paise (INR)
      currency: 'INR',
      receipt: orderId,
      payment_capture: 1, // CRITICAL: This tells Razorpay to capture the payment automatically.
      notes: {
        quizId: quiz._id.toString(),
        userId: userId.toString()
      }
    });

    const order = new Order({
      userId,
      orderId,
      amount: quiz.price,
      currency: 'INR', // Changed to INR for Razorpay
      paymentMethod: 'card', // Default
      razorpayOrderId: razorpayOrder.id,
      items: [{
        itemType: 'quiz',
        itemId: quiz._id,
        name: quiz.title,
        price: quiz.price,
        quantity: 1
      }],
      billingAddress: {} // Can be expanded later
    });

    await order.save();

    res.json({
      success: true,
      message: 'Order created successfully',
      order: {
        _id: order._id,
        orderId,
        amount: quiz.price,
        currency: 'INR',
        quiz: {
          title: quiz.title,
          category: quiz.category
        },
        razorpayOrder: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          receipt: razorpayOrder.receipt
        }
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature, status } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // --- CRITICAL: Enforce Signature Verification ---
    // This block MUST execute and be validated to prevent fraudulent success calls.
    if (!process.env.RAZORPAY_KEY_SECRET || !signature) {
      return res.status(400).json({ success: false, message: 'Payment signature is missing. Cannot verify.' });
    }

    const razorpayOrderId = order.razorpayOrderId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpayOrderId + '|' + paymentId)
      .digest('hex');

    // If the signature does not match, it's a fraudulent or failed attempt.
    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Signature mismatch.' });
    }

    // Update order status
    order.status = status === 'success' ? 'completed' : 'failed';
    order.transactionId = paymentId;
    order.completedAt = new Date();

    await order.save();

    // If payment is successful, register the user for the quiz
    if (status === 'success' && order.items && order.items.length > 0) {
      const quizItem = order.items.find(item => item.itemType === 'quiz');
      if (quizItem) {
        const quiz = await Quiz.findById(quizItem.itemId);
        if (quiz) {
          // Check if user is already registered
          const isAlreadyRegistered = quiz.participants.some(p => p.userId.toString() === order.userId.toString());
          if (!isAlreadyRegistered) {
            quiz.participants.push({
              userId: order.userId,
              joinedAt: new Date()
            });
            // FIX: Increment the registeredUsers count
            quiz.registeredUsers = (quiz.registeredUsers || 0) + 1; // Correctly increment
            await quiz.save();
          }
        }
      }
    }

    res.json({
      success: true,
      message: status === 'success' ? 'Payment verified successfully' : 'Payment failed',
      order: {
        orderId: order.orderId,
        status: order.status,
        amount: order.amount,
        transactionId: order.transactionId
      }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments({ userId });

    res.json({
      success: true,
      orders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        hasNext: page * limit < totalOrders,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get orders',
      error: error.message
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      orderId: req.params.orderId,
      userId: req.user._id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Get order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get order',
      error: error.message
    });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const orders = await Order.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments(filter);

    res.json({
      success: true,
      orders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        hasNext: page * limit < totalOrders,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get orders',
      error: error.message
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findOne({ orderId: req.params.orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    order.status = status;
    if (status === 'completed') {
      order.completedAt = new Date();
    }

    await order.save();

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
};

module.exports = {
  getRazorpayKey,
  createOrder,
  verifyPayment,
  getUserOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus
};
