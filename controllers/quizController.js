const Quiz = require('../models/Quiz');
const Result = require('../models/Result');
const User = require('../models/User');

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

async function tempSeed(req, res) {
    try {
        let admin = await User.findOne({ role: 'superadmin' });
        if (!admin) {
            admin = await User.findOne({ role: 'admin' });
        }
        if (!admin) {
            admin = await User.findOne({});
        }
        if (!admin) {
            // Create a default superadmin user if no users exist
            admin = new User({
                name: "Osian Hub Admin",
                email: "admin@osianhub.com",
                password: "hashedpassword123",
                role: "superadmin",
                isVerified: true,
                isApproved: true
            });
            await admin.save();
        }

        // Delete existing quizzes
        await Quiz.deleteMany({});

        const quizzes = [
            {
                title: "Web Development & JavaScript Fundamentals",
                description: "Test your understanding of JavaScript, DOM manipulation, asynchronous programming, and browser APIs.",
                category: "technical",
                field: "Computer Science",
                difficulty: "medium",
                quizType: "practice",
                status: "active",
                duration: 15,
                price: 0,
                passingScore: 50,
                coverImage: "https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?auto=format&fit=crop&w=800&q=80",
                numQuestionsToShow: 5,
                visibility: "public",
                createdBy: admin._id,
                questions: [
                    {
                        questionText: "Which of the following is NOT a JavaScript data type?",
                        questionType: "mcq",
                        options: [
                            { text: "String" },
                            { text: "Boolean" },
                            { text: "Float" },
                            { text: "Undefined" }
                        ],
                        correctAnswer: 2,
                        explanation: "Float is not a separate primitive data type in JavaScript. JavaScript numbers are represented as double-precision floating-point numbers.",
                        marks: 1
                    },
                    {
                        questionText: "What does the 'typeof' operator return for 'null'?",
                        questionType: "mcq",
                        options: [
                            { text: "\"null\"" },
                            { text: "\"object\"" },
                            { text: "\"undefined\"" },
                            { text: "\"number\"" }
                        ],
                        correctAnswer: 1,
                        explanation: "In JavaScript, typeof null is a historically known bug that returns 'object'.",
                        marks: 1
                    },
                    {
                        questionText: "Which keyword is used to declare block-scoped variables in modern JavaScript?",
                        questionType: "mcq",
                        options: [
                            { text: "var" },
                            { text: "let" },
                            { text: "define" },
                            { text: "global" }
                        ],
                        correctAnswer: 1,
                        explanation: "The 'let' (and 'const') keywords introduce block-scoped variable declaration in JavaScript (ES6).",
                        marks: 1
                    },
                    {
                        questionText: "What is the output of '2' + 2 in JavaScript?",
                        questionType: "mcq",
                        options: [
                            { text: "4" },
                            { text: "\"22\"" },
                            { text: "NaN" },
                            { text: "TypeError" }
                        ],
                        correctAnswer: 1,
                        explanation: "The addition operator triggers string coercion when one operand is a string, resulting in string concatenation.",
                        marks: 1
                    },
                    {
                        questionText: "Which method is used to serialize a JavaScript object into a JSON string?",
                        questionType: "mcq",
                        options: [
                            { text: "JSON.parse()" },
                            { text: "JSON.stringify()" },
                            { text: "Object.toJSON()" },
                            { text: "JSON.toObject()" }
                        ],
                        correctAnswer: 1,
                        explanation: "JSON.stringify() serializes a JavaScript value or object into a JSON string.",
                        marks: 1
                    }
                ]
            },
            {
                title: "Indian Constitution & Law Quiz",
                description: "Explore core principles of Indian law, fundamental rights, and the framework of the Indian Constitution.",
                category: "law",
                field: "Legal Studies",
                difficulty: "hard",
                quizType: "practice",
                status: "active",
                duration: 20,
                price: 0,
                passingScore: 60,
                coverImage: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80",
                numQuestionsToShow: 5,
                visibility: "public",
                createdBy: admin._id,
                questions: [
                    {
                        questionText: "Who is known as the Father of the Indian Constitution?",
                        questionType: "mcq",
                        options: [
                            { text: "Mahatma Gandhi" },
                            { text: "Dr. B.R. Ambedkar" },
                            { text: "Jawaharlal Nehru" },
                            { text: "Dr. Rajendra Prasad" }
                        ],
                        correctAnswer: 1,
                        explanation: "Dr. Bhimrao Ramji Ambedkar served as the chairman of the Drafting Committee of the Indian Constitution.",
                        marks: 1
                    },
                    {
                        questionText: "Which article of the Indian Constitution guarantees the Right to Equality?",
                        questionType: "mcq",
                        options: [
                            { text: "Article 12" },
                            { text: "Article 14" },
                            { text: "Article 19" },
                            { text: "Article 21" }
                        ],
                        correctAnswer: 1,
                        explanation: "Article 14 of the Indian Constitution guarantees equality before law and equal protection of laws.",
                        marks: 1
                    },
                    {
                        questionText: "What is the minimum age required to become the Prime Minister of India if they are a member of Lok Sabha?",
                        questionType: "mcq",
                        options: [
                            { text: "21 years" },
                            { text: "25 years" },
                            { text: "30 years" },
                            { text: "35 years" }
                        ],
                        correctAnswer: 1,
                        explanation: "Since the minimum age for entering the Lok Sabha is 25 years, a Lok Sabha member PM must be at least 25 years old.",
                        marks: 1
                    },
                    {
                        questionText: "The Fundamental Duties were incorporated into the Constitution of India by which Amendment?",
                        questionType: "mcq",
                        options: [
                            { text: "42nd Amendment" },
                            { text: "44th Amendment" },
                            { text: "86th Amendment" },
                            { text: "101st Amendment" }
                        ],
                        correctAnswer: 0,
                        explanation: "The Fundamental Duties were added by the 42nd Constitutional Amendment Act of 1976 on the recommendation of the Swaran Singh Committee.",
                        marks: 1
                    },
                    {
                        questionText: "Who appoints the Chief Justice of India?",
                        questionType: "mcq",
                        options: [
                            { text: "The Prime Minister" },
                            { text: "The President" },
                            { text: "The Chief Minister" },
                            { text: "The Parliament" }
                        ],
                        correctAnswer: 1,
                        explanation: "The President of India appoints the Chief Justice of India after consultation with judges of the Supreme Court.",
                        marks: 1
                    }
                ]
            },
            {
                title: "Engineering Mechanics & Core Concepts",
                description: "Solve physics and mechanics problems based on statics, dynamics, torque, and materials properties.",
                category: "engineering",
                field: "Mechanical Engineering",
                difficulty: "medium",
                quizType: "practice",
                status: "active",
                duration: 15,
                price: 0,
                passingScore: 50,
                coverImage: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
                numQuestionsToShow: 5,
                visibility: "public",
                createdBy: admin._id,
                questions: [
                    {
                        questionText: "What is the SI unit of force?",
                        questionType: "mcq",
                        options: [
                            { text: "Pascal" },
                            { text: "Joule" },
                            { text: "Newton" },
                            { text: "Watt" }
                        ],
                        correctAnswer: 2,
                        explanation: "The SI unit of force is the Newton (N), named after Sir Isaac Newton.",
                        marks: 1
                    },
                    {
                        questionText: "According to Hooke's Law, stress is directly proportional to what within the elastic limit?",
                        questionType: "mcq",
                        options: [
                            { text: "Force" },
                            { text: "Strain" },
                            { text: "Area" },
                            { text: "Volume" }
                        ],
                        correctAnswer: 1,
                        explanation: "Hooke's Law states that stress is directly proportional to strain within the proportional/elastic limit of the material.",
                        marks: 1
                    },
                    {
                        questionText: "What is the first law of thermodynamics primarily concerned with?",
                        questionType: "mcq",
                        options: [
                            { text: "Conservation of mass" },
                            { text: "Conservation of energy" },
                            { text: "Entropy creation" },
                            { text: "Absolute zero temperature" }
                        ],
                        correctAnswer: 1,
                        explanation: "The first law of thermodynamics is a formulation of the law of conservation of energy.",
                        marks: 1
                    },
                    {
                        questionText: "Which material property describes its ability to resist indentation or scratching?",
                        questionType: "mcq",
                        options: [
                            { text: "Ductility" },
                            { text: "Malleability" },
                            { text: "Hardness" },
                            { text: "Toughness" }
                        ],
                        correctAnswer: 2,
                        explanation: "Hardness measures a material's resistance to localized plastic deformation, indentation, or scratching.",
                        marks: 1
                    },
                    {
                        questionText: "What is the torque acting on a body if the force applied is parallel to the position vector?",
                        questionType: "mcq",
                        options: [
                            { text: "Maximum" },
                            { text: "Zero" },
                            { text: "Infinite" },
                            { text: "Half of maximum" }
                        ],
                        correctAnswer: 1,
                        explanation: "Torque is given by the cross product r x F. Since the angle is 0 or 180 degrees, sin(theta) is 0, making torque zero.",
                        marks: 1
                    }
                ]
            },
            {
                title: "Global General Knowledge & Science",
                description: "Challenge yourself with miscellaneous facts about the solar system, chemistry, geography, and events.",
                category: "gk",
                field: "General Awareness",
                difficulty: "easy",
                quizType: "practice",
                status: "active",
                duration: 10,
                price: 0,
                passingScore: 50,
                coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
                numQuestionsToShow: 5,
                visibility: "public",
                createdBy: admin._id,
                questions: [
                    {
                        questionText: "Which planet is known as the Red Planet?",
                        questionType: "mcq",
                        options: [
                            { text: "Venus" },
                            { text: "Jupiter" },
                            { text: "Mars" },
                            { text: "Saturn" }
                        ],
                        correctAnswer: 2,
                        explanation: "Mars is called the Red Planet because iron minerals in its soil rust, causing the soil and atmosphere to look red.",
                        marks: 1
                    },
                    {
                        questionText: "What is the chemical symbol for Gold?",
                        questionType: "mcq",
                        options: [
                            { text: "Ag" },
                            { text: "Au" },
                            { text: "Fe" },
                            { text: "Pb" }
                        ],
                        correctAnswer: 1,
                        explanation: "The chemical symbol for Gold is Au, derived from the Latin word 'Aurum' meaning shining dawn.",
                        marks: 1
                    },
                    {
                        questionText: "Which is the largest ocean on Earth?",
                        questionType: "mcq",
                        options: [
                            { text: "Atlantic Ocean" },
                            { text: "Indian Ocean" },
                            { text: "Arctic Ocean" },
                            { text: "Pacific Ocean" }
                        ],
                        correctAnswer: 3,
                        explanation: "The Pacific Ocean is the largest and deepest of Earth's oceanic divisions, covering about 30% of the planet's surface.",
                        marks: 1
                    },
                    {
                        questionText: "What gas do plants absorb from the atmosphere for photosynthesis?",
                        questionType: "mcq",
                        options: [
                            { text: "Oxygen" },
                            { text: "Nitrogen" },
                            { text: "Carbon Dioxide" },
                            { text: "Hydrogen" }
                        ],
                        correctAnswer: 2,
                        explanation: "Plants take in carbon dioxide (CO2) and water (H2O) to synthesize sugars, releasing oxygen (O2) as a byproduct.",
                        marks: 1
                    },
                    {
                        questionText: "Who wrote 'Romeo and Juliet'?",
                        questionType: "mcq",
                        options: [
                            { text: "Charles Dickens" },
                            { text: "William Shakespeare" },
                            { text: "Leo Tolstoy" },
                            { text: "Mark Twain" }
                        ],
                        correctAnswer: 1,
                        explanation: "William Shakespeare wrote the tragic play 'Romeo and Juliet' early in his career.",
                        marks: 1
                    }
                ]
            },
            {
                title: "Advanced Data Structures & Algorithms",
                description: "Solve complex questions related to recursion, graphs, dynamic programming, and complexity bounds.",
                category: "technical",
                field: "Computer Science",
                difficulty: "hard",
                quizType: "practice",
                status: "active",
                duration: 20,
                price: 0,
                passingScore: 60,
                coverImage: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80",
                numQuestionsToShow: 5,
                visibility: "public",
                createdBy: admin._id,
                questions: [
                    {
                        questionText: "What is the worst-case time complexity of lookup in a Red-Black Tree?",
                        questionType: "mcq",
                        options: [
                            { text: "O(1)" },
                            { text: "O(log n)" },
                            { text: "O(n)" },
                            { text: "O(n log n)" }
                        ],
                        correctAnswer: 1,
                        explanation: "Red-Black Trees are self-balancing binary search trees that guarantee O(log n) time complexity for search, insert, and delete operations in the worst case.",
                        marks: 1
                    },
                    {
                        questionText: "Which algorithm is used to find the shortest path in a graph with negative edge weights but no negative cycles?",
                        questionType: "mcq",
                        options: [
                            { text: "Dijkstra's Algorithm" },
                            { text: "Bellman-Ford Algorithm" },
                            { text: "Kruskal's Algorithm" },
                            { text: "Prim's Algorithm" }
                        ],
                        correctAnswer: 1,
                        explanation: "The Bellman-Ford algorithm computes single-source shortest paths in a weighted graph, even with negative weights (unlike Dijkstra).",
                        marks: 1
                    },
                    {
                        questionText: "What is the space complexity of an in-place sorting algorithm like Heap Sort?",
                        questionType: "mcq",
                        options: [
                            { text: "O(1)" },
                            { text: "O(log n)" },
                            { text: "O(n)" },
                            { text: "O(n^2)" }
                        ],
                        correctAnswer: 0,
                        explanation: "Heap Sort is an in-place sorting algorithm and requires only O(1) auxiliary space.",
                        marks: 1
                    },
                    {
                        questionText: "Which problem class describes NP-Hard problems that are also in NP?",
                        questionType: "mcq",
                        options: [
                            { text: "P-Space" },
                            { text: "NP-Complete" },
                            { text: "NP-Easy" },
                            { text: "Co-NP" }
                        ],
                        correctAnswer: 1,
                        explanation: "By definition, a problem is NP-Complete if it is NP-Hard and is also in the complexity class NP.",
                        marks: 1
                    },
                    {
                        questionText: "What data structure is typically used to implement Breadth-First Search (BFS)?",
                        questionType: "mcq",
                        options: [
                            { text: "Stack" },
                            { text: "Queue" },
                            { text: "Priority Queue" },
                            { text: "Hash Map" }
                        ],
                        correctAnswer: 1,
                        explanation: "BFS explores neighbors level-by-level using a FIFO Queue data structure.",
                        marks: 1
                    }
                ]
            },
            {
                title: "GK & Historical Landmarks Quiz",
                description: "A trivia set of history, culture, monument, and historical events around the globe.",
                category: "gk",
                field: "History",
                difficulty: "easy",
                quizType: "practice",
                status: "active",
                duration: 10,
                price: 0,
                passingScore: 50,
                coverImage: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80",
                numQuestionsToShow: 5,
                visibility: "public",
                createdBy: admin._id,
                questions: [
                    {
                        questionText: "Where is the Taj Mahal located?",
                        questionType: "mcq",
                        options: [
                            { text: "Delhi" },
                            { text: "Jaipur" },
                            { text: "Agra" },
                            { text: "Mumbai" }
                        ],
                        correctAnswer: 2,
                        explanation: "The Taj Mahal is an ivory-white marble mausoleum on the south bank of the Yamuna river in Agra, India.",
                        marks: 1
                    },
                    {
                        questionText: "In which year did India gain Independence from British rule?",
                        questionType: "mcq",
                        options: [
                            { text: "1942" },
                            { text: "1947" },
                            { text: "1950" },
                            { text: "1952" }
                        ],
                        correctAnswer: 1,
                        explanation: "India achieved independence from British rule on August 15, 1947.",
                        marks: 1
                    },
                    {
                        questionText: "Which monument is located in Paris, France?",
                        questionType: "mcq",
                        options: [
                            { text: "Eiffel Tower" },
                            { text: "Colosseum" },
                            { text: "Statue of Liberty" },
                            { text: "Big Ben" }
                        ],
                        correctAnswer: 0,
                        explanation: "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France.",
                        marks: 1
                    },
                    {
                        questionText: "Who was the first President of the United States?",
                        questionType: "mcq",
                        options: [
                            { text: "Thomas Jefferson" },
                            { text: "Abraham Lincoln" },
                            { text: "George Washington" },
                            { text: "John Adams" }
                        ],
                        correctAnswer: 2,
                        explanation: "George Washington was the first President of the United States, serving from 1789 to 1797.",
                        marks: 1
                    },
                    {
                        questionText: "Which ancient civilization built the pyramids of Giza?",
                        questionType: "mcq",
                        options: [
                            { text: "Roman" },
                            { text: "Greek" },
                            { text: "Egyptian" },
                            { text: "Mesopotamian" }
                        ],
                        correctAnswer: 2,
                        explanation: "The pyramids of Giza were built during the Old Kingdom period of Ancient Egypt.",
                        marks: 1
                    }
                ]
            }
        ];

        await Quiz.insertMany(quizzes);
        res.status(200).json({ success: true, message: "Successfully seeded 6 representative quizzes!" });
    } catch (err) {
        console.error("Seeding error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    createQuiz,
    getQuizzes,
    getQuizById,
    updateQuiz,
    deleteQuiz,
    getQuizStats,
    getCategories,
    getAdminQuizzes,
    getUserRegisteredQuizzes,
    tempSeed
};
