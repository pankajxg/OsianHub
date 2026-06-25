const express = require('express');
const router = express.Router();
const { protect, adminOnly, superAdminOnly } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

router.get('/key', paymentController.getRazorpayKey);
router.post('/create-order', protect, paymentController.createOrder);
router.post('/verify', protect, paymentController.verifyPayment);
router.get('/orders', protect, paymentController.getUserOrders);
router.get('/orders/all', protect, adminOnly, paymentController.getAllOrders);
router.get('/orders/:orderId', protect, paymentController.getOrderById);
router.put('/orders/:orderId/status', protect, adminOnly, paymentController.updateOrderStatus);

module.exports = router;
