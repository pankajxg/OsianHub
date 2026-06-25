const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema({
    questionIndex: { type: Number },
    selectedAnswer: { type: Number },
    selectedAnswers: [{ type: Number }],
    writtenAnswer: { type: String },
    isCorrect: { type: Boolean },
    correctIndices: [{ type: Number }],
    explanation: { type: String },
    timeSpent: { type: Number, default: 0 },
}, { _id: false });

const ResultSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    percentage: { type: Number },
    passed: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'completed'], default: 'completed' },
    releaseTime: { type: Date },
    cheatingViolation: { type: mongoose.Schema.Types.Mixed },
    violationCount: { type: Number, default: 0 },
    answers: [AnswerSchema],
    timeTaken: { type: Number }, // in seconds
    completedAt: { type: Date, default: Date.now },
});

// Auto-calculate percentage before saving
ResultSchema.pre('save', function (next) {
    if (this.totalQuestions > 0) {
        this.percentage = (this.score / this.totalQuestions) * 100;
    }
    next();
});

module.exports = mongoose.model('Result', ResultSchema);
