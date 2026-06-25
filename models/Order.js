const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
    itemType: { type: String, default: 'quiz' },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
    name: { type: String },
    price: { type: Number },
    quantity: { type: Number, default: 1 },
}, { _id: false });

const OrderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentMethod: { type: String, default: 'card' },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
    razorpayOrderId: { type: String },
    transactionId: { type: String },
    items: [OrderItemSchema],
    billingAddress: { type: mongoose.Schema.Types.Mixed },
    completedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Order', OrderSchema);
