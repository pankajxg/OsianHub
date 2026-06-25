const mongoose = require('mongoose');

const LeaderboardEntrySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scope: { type: String, enum: ['global', 'quiz', 'batch'], default: 'global' },
    scopeRef: { type: String, default: null }, // e.g. batch key
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', default: null },
    period: { type: String, enum: ['all', '30d', '7d'], default: 'all' },
    avgScore: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 },
    compositeScore: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
});

LeaderboardEntrySchema.index({ userId: 1, scope: 1, quizId: 1, period: 1, scopeRef: 1 }, { unique: true });

module.exports = mongoose.model('LeaderboardEntry', LeaderboardEntrySchema);
