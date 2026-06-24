const Quiz = require('../models/Quiz');
const Result = require('../models/Result');

/**
 * @desc    Create a new quiz
 * @route   POST /api/quizzes
 * @access  Private (Admin, Superadmin)
 */
async function createQuiz(req, res) {
    try {
        // --- 1. Extract data from request ---
        const {
            title,
            description,
            category,
            field,
            difficulty,
            quizType,
            duration,
            registrationLimit,
            scheduleTime,
            price,
            coverImage, // Base64 string
            questions,  // Array of question objects
            numQuestionsToShow,
            visibility
        } = req.body;

        // --- 2. Basic Validation ---
        if (!title || !category || !quizType || !duration || !questions || questions.length === 0) {
            return res.status(400).json({ message: 'Please provide all required quiz details, including at least one question.' });
        }
        
        // --- 3. Create new quiz instance ---
        const newQuiz = new Quiz({
            title,
            description,
            category,
            field,
            difficulty,
            quizType,
            duration,
            registrationLimit,
            scheduleTime,
            price,
            coverImage,
            questions,
            numQuestionsToShow,
            visibility,
            createdBy: req.user.id
        });

        // Status logic:
        // - Paid quizzes are always 'active' (registration open immediately)
        // - Other types: 'upcoming' if scheduled in future, else 'active'
        if (String(quizType).toLowerCase() === 'paid') {
            newQuiz.status = 'active';
        } else if (scheduleTime && new Date(scheduleTime) > new Date()) {
            newQuiz.status = 'upcoming';
        } else {
            newQuiz.status = 'active';
        }

        // --- 4. Save to database ---
        const savedQuiz = await newQuiz.save();

        // --- 5. Send success response ---
        res.status(201).json(savedQuiz);

    } catch (error) {
        console.error('Error creating quiz:', error);
        // Handle validation errors from Mongoose
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation Error: ${error.message}` });
        }
        res.status(500).json({ message: 'Server error while creating quiz.' });
    }
};

/**
 * @desc    Get all quizzes, categorized for the user dashboard or all for admin management
 * @route   GET /api/quizzes
 * @access  Public (for user dashboard), Private (for admin management)
 */
async function getQuizzes(req, res) {
    try {
        console.log('getQuizzes called, req.user:', req.user ? req.user.role : 'undefined');
        // Admins and Superadmins get all quizzes for management
        // The `req.user` object is populated by your authentication middleware
        if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
            const allQuizzes = await Quiz.find()
                .populate('createdBy', 'name email') // Populate creator info for admin view
                .sort({ createdAt: -1 });
            return res.status(200).json({ allQuizzes }); // Return all quizzes under 'allQuizzes' key
        }

        // Regular users get categorized quizzes for their dashboard
        const allQuizzes = await Quiz.find()
            .populate('createdBy', 'name') // Only need creator name for user view
            .sort({ createdAt: -1 });

        const isListed = q => String(q.visibility || 'public').toLowerCase() !== 'unlisted';
        const featured = {
            live: allQuizzes.filter(q => q.quizType === 'live' && isListed(q)),
            paid: allQuizzes.filter(q => q.quizType === 'paid' && isListed(q)),
            upcoming: allQuizzes.filter(q => q.quizType === 'upcoming' && isListed(q))
        };

        const categories = {
            technical: allQuizzes.filter(q => q.category === 'technical' && isListed(q)),
            law: allQuizzes.filter(q => q.category === 'law' && isListed(q)),
            engineering: allQuizzes.filter(q => q.category === 'engineering' && isListed(q)),
            gk: allQuizzes.filter(q => (q.category === 'gk' || q.category === 'general' || q.category === 'generalKnowledge') && isListed(q)),
            sports: allQuizzes.filter(q => q.category === 'sports' && isListed(q))
        };

        res.status(200).json({ featured, categories });

    } catch (error) {
        console.error('Error fetching quizzes:', error);
        res.status(500).json({ message: 'Server error while fetching quizzes.' });
    }
};

/**
 * @desc    Get a single quiz by its ID
 * @route   GET /api/quizzes/:id
 * @access  Private (Logged-in users)
 */
async function getQuizById(req, res) {
    try {
        const quiz = await Quiz.findById(req.params.id)
            .populate('createdBy', 'name email'); // Populate creator info

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found.' });
        }

        // Auto-transition upcoming -> active when schedule time passes
        if (quiz.status === 'upcoming' && quiz.scheduleTime && new Date(quiz.scheduleTime) <= new Date()) {
            quiz.status = 'active';
            try { await quiz.save(); } catch (_) {}
        }

        // If a regular user, randomize questions and shuffle options; hide answers
        if (req.user && req.user.role === 'user') {
            if (quiz.scheduleTime && new Date(quiz.scheduleTime) > new Date()) {
                const startsAt = new Date(quiz.scheduleTime).toISOString();
                return res.status(403).json({
                    message: `This quiz starts at ${startsAt}. Please return at the scheduled time.`,
                    startsAt,
                    code: 'SCHEDULED_NOT_STARTED'
                });
            }

            const quizObj = quiz.toObject();
            const total = Array.isArray(quizObj.questions) ? quizObj.questions.length : 0;
            const count = Math.min(Number(quizObj.numQuestionsToShow || total) || total, total);
            // Fisher-Yates shuffle clone
            const indices = Array.from({ length: total }, (_, i) => i);
            for (let i = total - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
            }
            const selected = indices.slice(0, count).map(i => quizObj.questions[i]);
            const randomizedQuestions = selected.map(q => {
                if (q.questionType === 'mcq' && Array.isArray(q.options)) {
                    // Shuffle options
                    const opts = q.options.map((o, idx) => ({ ...o, __idx: idx }));
                    for (let i = opts.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [opts[i], opts[j]] = [opts[j], opts[i]];
                    }
                    const cleanOpts = opts.map(o => ({ text: o.text, image: o.image }));
                    return {
                        questionText: q.questionText,
                        questionType: q.questionType,
                        questionImage: q.questionImage,
                        marks: q.marks,
                        isMultiple: !!q.isMultiple,
                        options: cleanOpts
                    };
                }
                // Written / coding
                return {
                    questionText: q.questionText,
                    questionType: q.questionType,
                    questionImage: q.questionImage,
                    marks: q.marks,
                    codeLanguage: q.codeLanguage,
                    codeStarter: q.codeStarter
                };
            });

            return res.status(200).json({
                _id: quizObj._id,
                title: quizObj.title,
                description: quizObj.description,
                category: quizObj.category,
                field: quizObj.field,
                difficulty: quizObj.difficulty,
                quizType: quizObj.quizType,
                duration: quizObj.duration,
                coverImage: quizObj.coverImage,
                scheduleTime: quizObj.scheduleTime,
                visibility: quizObj.visibility,
                questions: randomizedQuestions
            });
        }

        // Admins/Superadmins get full quiz data
        res.status(200).json(quiz);

    } catch (error) {
        console.error(`Error fetching quiz ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error.' });
    }
};

/**
 * @desc    Update a quiz
 * @route   PUT /api/quizzes/:id
 * @access  Private (Admin, Superadmin, or Creator)
 */
async function updateQuiz(req, res) {
    try {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found.' });
        }

        // Check if user can update this quiz
        // Only creator, admin, or superadmin can update
        if (quiz.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Not authorized to update this quiz.' });
        }

        // Update fields from req.body
        const { title, description, category, field, difficulty, quizType, duration, registrationLimit, scheduleTime, price, coverImage, questions, numQuestionsToShow, visibility } = req.body;

        quiz.title = title || quiz.title;
        quiz.description = description !== undefined ? description : quiz.description;
        quiz.category = category || quiz.category;
        quiz.field = field !== undefined ? field : quiz.field;
        quiz.difficulty = difficulty !== undefined ? difficulty : quiz.difficulty;
        quiz.quizType = quizType || quiz.quizType;
        quiz.duration = duration || quiz.duration;
        quiz.registrationLimit = registrationLimit !== undefined ? registrationLimit : quiz.registrationLimit;
        quiz.scheduleTime = scheduleTime !== undefined ? scheduleTime : quiz.scheduleTime;
        quiz.price = price !== undefined ? price : quiz.price;
        quiz.coverImage = coverImage || quiz.coverImage;
        quiz.visibility = visibility || quiz.visibility;
        quiz.numQuestionsToShow = numQuestionsToShow !== undefined ? numQuestionsToShow : quiz.numQuestionsToShow;

        // Merge questions preserving existing images/explanations if not provided
        if (Array.isArray(questions)) {
            const existing = Array.isArray(quiz.questions) ? quiz.questions.map(q => q.toObject ? q.toObject() : q) : [];
            quiz.questions = questions.map((qNew, idx) => {
                const qOld = existing[idx] || {};
                const merged = {
                    questionText: qNew.questionText || qOld.questionText,
                    questionType: qNew.questionType || qOld.questionType,
                    questionImage: qNew.questionImage || qOld.questionImage,
                    explanation: qNew.explanation !== undefined ? qNew.explanation : qOld.explanation,
                    marks: qNew.marks !== undefined ? qNew.marks : (qOld.marks || 1),
                    isMultiple: qNew.isMultiple !== undefined ? qNew.isMultiple : (qOld.isMultiple || false),
                    codeLanguage: qNew.codeLanguage || qOld.codeLanguage,
                    codeStarter: qNew.codeStarter !== undefined ? qNew.codeStarter : qOld.codeStarter
                };
                if ((qNew.questionType || qOld.questionType) === 'mcq') {
                    const newOpts = Array.isArray(qNew.options) ? qNew.options : [];
                    const oldOpts = Array.isArray(qOld.options) ? qOld.options : [];
                    merged.options = newOpts.map((opt, i) => ({
                        text: (opt && opt.text) || (oldOpts[i] && oldOpts[i].text) || '',
                        image: (opt && opt.image) || (oldOpts[i] && oldOpts[i].image) || undefined
                    }));
                    merged.correctAnswer = qNew.correctAnswer !== undefined ? qNew.correctAnswer : qOld.correctAnswer;
                    merged.correctAnswers = Array.isArray(qNew.correctAnswers) ? qNew.correctAnswers : (Array.isArray(qOld.correctAnswers) ? qOld.correctAnswers : undefined);
                }
                return merged;
            });
        }

        // Recalculate status based on type and schedule
        if (String(quiz.quizType).toLowerCase() === 'paid') {
            quiz.status = 'active';
        } else if (quiz.scheduleTime && new Date(quiz.scheduleTime) > new Date()) {
            quiz.status = 'upcoming';
        } else if (quiz.status === 'upcoming') {
            quiz.status = 'active';
        }

        quiz.updatedAt = Date.now();
        await quiz.save();

        res.status(200).json(quiz);

    } catch (error) {
        console.error('Error updating quiz:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation Error: ${error.message}` });
        }
        res.status(500).json({ message: 'Server error while updating quiz.' });
    }
};

/**
 * @desc    Delete a quiz
 * @route   DELETE /api/quizzes/:id
 * @access  Private (Admin, Superadmin, or Creator)
 */
async function deleteQuiz(req, res) {
    try {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found.' });
        }

        // Check if user can delete this quiz
        // Only creator, admin, or superadmin can delete
        if (quiz.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Not authorized to delete this quiz.' });
        }

        await Quiz.findByIdAndDelete(req.params.id);

        res.status(200).json({ message: 'Quiz deleted successfully.' });

    } catch (error) {
        console.error('Error deleting quiz:', error);
        res.status(500).json({ message: 'Server error while deleting quiz.' });
    }
};

// The following functions are from the original context and are kept for completeness.
// They might need further adjustments based on the updated Quiz model if they are actively used.

async function getQuizStats(req, res) {
    try {
        const quizId = req.params.id;

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        const totalAttempts = await Result.countDocuments({ quizId });
        const completedAttempts = await Result.countDocuments({
            quizId,
            status: 'completed'
        });

        const results = await Result.find({ quizId, status: 'completed' });
        const averageScore = results.length > 0
            ? results.reduce((sum, result) => sum + result.percentage, 0) / results.length
            : 0;

        const passedAttempts = results.filter(result => result.passed).length;
        const passRate = completedAttempts > 0 ? (passedAttempts / completedAttempts) * 100 : 0;

        res.json({
            success: true,
            stats: {
                totalAttempts,
                completedAttempts,
                averageScore: Math.round(averageScore),
                passRate: Math.round(passRate),
                // The original Quiz model in context had 'participants', but the updated one does not.
                // If you need participant count, you'd need to track it in the Quiz model or via Results.
                // participants: quiz.participants.length
            }
        });
    } catch (error) {
        console.error('Get quiz stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get quiz stats',
            error: error.message
        });
    }
};

async function getCategories(req, res) {
    try {
        // Assuming 'isActive' is a field in the Quiz model for filtering active quizzes
        // Removed { isActive: true } as it's not explicitly in the updated model for general categories
        const categories = await Quiz.distinct('category'); 

        res.json({
            success: true,
            categories
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get categories',
            error: error.message
        });
    }
};

/**
 * @desc    Get quizzes created by the logged-in admin
 * @route   GET /api/quizzes/admin
 * @access  Private (Admin, Superadmin)
 */
async function getAdminQuizzes(req, res) {
    try {
        const adminId = req.user.id;

        let quizzes = await Quiz.find({ createdBy: adminId })
            .sort({ createdAt: -1 });

        // Normalize: paid quizzes should show 'active'
        const toUpdate = quizzes.filter(q => String(q.quizType).toLowerCase() === 'paid' && q.status !== 'active');
        for (const q of toUpdate) {
            q.status = 'active';
            try { await q.save(); } catch (_) {}
        }

        res.status(200).json({
            success: true,
            quizzes
        });

    } catch (error) {
        console.error('Error fetching admin quizzes:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching quizzes.'
        });
    }
};

/**
 * @desc    Get quizzes registered by the logged-in user
 * @route   GET /api/quizzes/user/registered
 * @access  Private (User)
 */
async function getUserRegisteredQuizzes(req, res) {
    try {
        const userId = req.user.id;

        const quizzes = await Quiz.find({ 'participants.userId': userId })
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            quizzes
        });

    } catch (error) {
        console.error('Error fetching user registered quizzes:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching registered quizzes.'
        });
    }
};

module.exports = {
    createQuiz,
    getQuizzes,
    getQuizById,
    updateQuiz,
    deleteQuiz,
    getQuizStats,
    getCategories,
    getAdminQuizzes,
    getUserRegisteredQuizzes
};
