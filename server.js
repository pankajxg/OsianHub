require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// ──────────────────────────────────────────────
//  Connect to MongoDB
// ──────────────────────────────────────────────
connectDB();

// ──────────────────────────────────────────────
//  CORS — allow GitHub Pages frontend + localhost dev
// ──────────────────────────────────────────────
const allowedOrigins = [
    'https://pankajxg.github.io',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'http://localhost:5000',
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.some(o => origin.startsWith(o))) {
            return callback(null, true);
        }
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: false,
}));

// ──────────────────────────────────────────────
//  Body Parser
// ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ──────────────────────────────────────────────
//  Routes
// ──────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api/results', require('./routes/results'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/badges', require('./routes/badges'));
app.use('/api/mentorship', require('./routes/mentorship'));

// ──────────────────────────────────────────────
//  Health check
// ──────────────────────────────────────────────
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'OsianHub API is running 🚀',
        timestamp: new Date().toISOString(),
    });
});

// ──────────────────────────────────────────────
//  404 handler
// ──────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ──────────────────────────────────────────────
//  Global error handler
// ──────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

// ──────────────────────────────────────────────
//  Start server (skip when running as Vercel serverless)
// ──────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`🚀 OsianHub server running on port ${PORT}`);
    });
}

module.exports = app;
