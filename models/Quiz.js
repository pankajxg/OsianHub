const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema({
    text: { type: String },
    image: { type: String }, // base64 or URL
}, { _id: false });

const QuestionSchema = new mongoose.Schema({
    questionText: { type: String, required: true },
    questionType: { type: String, enum: ['mcq', 'written', 'coding'], default: 'mcq' },
    questionImage: { type: String },
    options: [OptionSchema],
    correctAnswer: { type: Number },        // Index of correct option (single)
    correctAnswers: [{ type: Number }],     // Indices (multiple correct)
    isMultiple: { type: Boolean, default: false },
    explanation: { type: String },
    marks: { type: Number, default: 1 },
    codeLanguage: { type: String },
    codeStarter: { type: String },
}, { _id: false });

const ParticipantSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
}, { _id: false });

const QuizSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: {
        type: String,
        enum: ['technical', 'law', 'engineering', 'gk', 'general', 'generalKnowledge', 'sports', 'other'],
        required: true,
    },
    field: { type: String },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    quizType: { type: String, enum: ['live', 'paid', 'upcoming', 'practice'], required: true },
    status: { type: String, enum: ['active', 'upcoming', 'completed', 'cancelled'], default: 'active' },
    duration: { type: Number, required: true }, // in minutes
    registrationLimit: { type: Number },
    registeredUsers: { type: Number, default: 0 },
    scheduleTime: { type: Date },
    price: { type: Number, default: 0 },
    passingScore: { type: Number, default: 50 }, // percentage
    coverImage: { type: String }, // base64 or URL
    questions: [QuestionSchema],
    numQuestionsToShow: { type: Number },
    visibility: { type: String, enum: ['public', 'unlisted', 'private'], default: 'public' },
    participants: [ParticipantSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Quiz', QuizSchema);
