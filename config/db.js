const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.error('⚠️  Server will continue running - retrying connection in background...');
        // Retry connection after 5 seconds instead of crashing
        setTimeout(connectDB, 5000);
    }
};

module.exports = connectDB;
