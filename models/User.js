const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6,
        select: false,
    },
    username: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'superadmin'],
        default: 'user',
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    isApproved: {
        type: Boolean,
        default: true, // Auto-approve regular users; admin approval can be set manually
    },
    otp: { type: String },
    otpExpires: { type: Date },
    resetToken: { type: String },
    resetOtp: { type: String },
    resetOtpExpires: { type: Date },
    profile: {
        avatar: { type: String },
        age: { type: String },
        college: { type: String },
        course: { type: String },
        year: { type: String },
        state: { type: String },
        city: { type: String },
        phone: { type: String },
        currentAddress: { type: String },
    },
    quizzesTaken: [
        {
            quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
            score: { type: Number },
            completedAt: { type: Date },
        },
    ],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model('User', UserSchema);
