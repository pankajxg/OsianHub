const Result = require('../models/Result');
const Quiz = require('../models/Quiz');
const User = require('../models/User');
const mongoose = require('mongoose');

const submitQuiz = async (req, res) => {
  try {
    const { quizId, answers, timeTaken, cheatingViolation, violationCount } = req.body; // Added cheatingViolation
    const userId = req.user.id;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Enforce: only one submission per paid listed/private quiz per user
    // Allow multiple submissions for unlisted paid quizzes
    if (quiz.quizType === 'paid' && String(quiz.visibility || 'public').toLowerCase() !== 'unlisted') {
      const existingResult = await Result.findOne({ userId, quizId });
      if (existingResult) {
        return res.status(409).json({
          success: false,
          message: 'Submission failed: you already submitted this paid quiz.'
        });
      }
    }
    // For paid quizzes, check if the user is registered in the quiz's `participants` array.
    // Temporarily disabled for testing
    // if (quiz.quizType === 'paid') {
    //   // Use mongoose.Types.ObjectId for safe comparison
    //   const isRegistered = quiz.participants.some(p => p.userId.equals(userId));
    //   if (!isRegistered) {
    //     return res.status(403).json({
    //       success: false,
    //       message: 'You must be registered for this paid quiz to submit answers'
    //     });
    //   }
    // }

    let correctAnswers = 0;
    const detailedAnswers = answers.map((answer) => {
      const q = quiz.questions[answer.questionIndex];
      if (!q) return null;
      let isCorrect = false;
      let selectedAnswers = Array.isArray(answer.selectedAnswers) ? answer.selectedAnswers : undefined;
      if (q.questionType === 'mcq') {
        if (q.isMultiple) {
          const expected = Array.isArray(q.correctAnswers) ? q.correctAnswers.slice().sort((a,b)=>a-b) : [];
          const selected = Array.isArray(selectedAnswers)
            ? selectedAnswers.slice().sort((a,b)=>a-b)
            : (typeof answer.selectedAnswer === 'number' ? [answer.selectedAnswer] : []);
          isCorrect = expected.length > 0 && selected.length === expected.length && expected.every((v,i)=>v===selected[i]);
        } else {
          const expectedSingle = typeof q.correctAnswer === 'number' ? q.correctAnswer : undefined;
          isCorrect = typeof answer.selectedAnswer === 'number' && answer.selectedAnswer === expectedSingle;
        }
      } else {
        isCorrect = false; // written/coding not auto-graded here
      }
      if (isCorrect) correctAnswers++;

      return {
        questionIndex: answer.questionIndex,
        selectedAnswer: answer.selectedAnswer,
        selectedAnswers,
        writtenAnswer: answer.writtenAnswer,
        isCorrect,
        correctIndices: Array.isArray(q.correctAnswers) ? q.correctAnswers : (typeof q.correctAnswer === 'number' ? [q.correctAnswer] : []),
        explanation: q.explanation,
        timeSpent: answer.timeSpent || 0
      };
    });

    const score = correctAnswers;
    const totalQuestions = quiz.questions.length; // Total questions in the quiz
    const percentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    let passed = percentage >= (quiz.passingScore || 50); // Match frontend logic (score > 0.5)

    // If cheating violation detected, force fail regardless of score
    if (cheatingViolation || (typeof violationCount === 'number' && violationCount >= 3)) {
      passed = false;
    }

    // For paid quizzes, set status to 'pending' and schedule release in 8 hours
    // EXCEPTION: Unlisted quizzes should release immediately (no pending)
    const isPaidListedQuiz = quiz.quizType === 'paid' && String(quiz.visibility || 'public').toLowerCase() !== 'unlisted';
    const status = isPaidListedQuiz ? 'pending' : 'completed';
    const releaseTime = isPaidListedQuiz ? new Date(Date.now() + 8 * 60 * 60 * 1000) : null; // 8 hours from now

    const result = new Result({
      userId,
      quizId,
      score: cheatingViolation ? 0 : score, // Set score 0 if cheating violation
      totalQuestions,
      status,
      passed,
      releaseTime,
      cheatingViolation: cheatingViolation || null,
      violationCount: typeof violationCount === 'number' ? violationCount : 0,
      answers: detailedAnswers.filter(a => a !== null).map(answer => ({
        questionIndex: answer.questionIndex,
        selectedAnswer: answer.selectedAnswer,
        selectedAnswers: answer.selectedAnswers,
        writtenAnswer: answer.writtenAnswer,
        isCorrect: answer.isCorrect,
        correctIndices: answer.correctIndices,
        explanation: answer.explanation,
        timeSpent: answer.timeSpent
      })),
      timeTaken,
      completedAt: new Date()
    });

    await result.save();

    // Async post-submit updates
    try {
      const { rebuildScopeLeaderboard } = require('./leaderboardController');
      const { awardBadgesForUser } = require('./badgeController');
      // Update leaderboards: global/all, global/30d, global/7d, quiz-level for this quiz
      await Promise.all([
        rebuildScopeLeaderboard({ scope: 'global', period: 'all' }),
        rebuildScopeLeaderboard({ scope: 'global', period: '30d' }),
        rebuildScopeLeaderboard({ scope: 'global', period: '7d' }),
        rebuildScopeLeaderboard({ scope: 'quiz', quizId, period: 'all' }),
        rebuildScopeLeaderboard({ scope: 'quiz', quizId, period: '30d' }),
        rebuildScopeLeaderboard({ scope: 'quiz', quizId, period: '7d' })
      ]);
      await awardBadgesForUser(userId);
    } catch (e) {
      console.warn('Post-submit updates failed:', e.message);
    }




    // Update user's quiz history in one call
    await User.findByIdAndUpdate(userId, {
      $push: {
        quizzesTaken: {
          quizId,
          score,
          completedAt: new Date()
        }
      }
    });

    if (cheatingViolation) {
      // Notify admin or superadmin of cheating violation
      const NotificationController = require('./notificationController');
      await NotificationController.sendCheatingNotification({
        userId,
        quizId,
        violationDetails: cheatingViolation
      });
    }

    res.json({
      success: true,
      message: 'Quiz submitted successfully',
      result: {
        score,
        totalQuestions, // Keep this for frontend display
        correctAnswers,
        percentage: Math.round(percentage),
        passed,
        timeTaken,
        status,
        releaseTime
      }
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit quiz',
      error: error.message
    });
  }
};

const getUserResults = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const results = await Result.find({ userId })
      .populate('quizId', 'title category difficulty quizType')
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalResults = await Result.countDocuments({ userId });

    res.json({
      success: true,
      results,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
        hasNext: page * limit < totalResults,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get user results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get results',
      error: error.message
    });
  }
};

const getResultById = async (req, res) => {
  try {
    const result = await Result.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('quizId', 'title description category difficulty questions');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    // Check if user can access this result
    if (result.userId._id.toString() !== req.user.id.toString() && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this result'
      });
    }

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Get result by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get result',
      error: error.message
    });
  }
};

const getQuizResults = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const results = await Result.find({ quizId })
      .populate('userId', 'name email')
      .sort({ score: -1, timeTaken: 1, completedAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalResults = await Result.countDocuments({ quizId });

    res.json({
      success: true,
      results,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
        hasNext: page * limit < totalResults,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get quiz results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get quiz results',
      error: error.message
    });
  }
};

const getLeaderboard = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const limit = parseInt(req.query.limit) || 10;

    const results = await Result.find({ quizId, status: 'completed' })
      .populate('userId', 'name email')
      .sort({ score: -1, timeTaken: 1 }) // Sort by score desc, then time asc
      .limit(limit);

    res.json({
      success: true,
      leaderboard: results.map((result, index) => ({
        rank: index + 1,
        user: {
          id: result.userId._id,
          name: result.userId.name,
          email: result.userId.email
        },
        score: result.score,
        percentage: result.totalQuestions > 0 ? (result.score / result.totalQuestions) * 100 : 0,
        timeTaken: result.timeTaken,
        completedAt: result.completedAt
      }))
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get leaderboard',
      error: error.message
    });
  }
};

const getAdminResults = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let results, totalResults;

    if (req.user.role === 'superadmin') {
      // Superadmin gets all results
      results = await Result.find({})
        .populate('userId', 'name email')
        .populate('quizId', 'title')
        .sort({ score: -1, timeTaken: 1, completedAt: -1 })
        .skip(skip)
        .limit(limit);

      totalResults = await Result.countDocuments({});
    } else {
      // Admin gets results only for quizzes they created
      const adminId = req.user._id;
      const Quiz = require('../models/Quiz');
      const adminQuizzes = await Quiz.find({ createdBy: adminId }).select('_id');
      const quizIds = adminQuizzes.map(quiz => quiz._id);

      results = await Result.find({ quizId: { $in: quizIds } })
        .populate('userId', 'name email')
        .populate('quizId', 'title')
        .sort({ score: -1, timeTaken: 1, completedAt: -1 })
        .skip(skip)
        .limit(limit);

      totalResults = await Result.countDocuments({ quizId: { $in: quizIds } });
    }

    res.json({
      success: true,
      results,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
        hasNext: page * limit < totalResults,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get admin results error:', error);
    // log full error stack for diagnosis
    console.error(error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to get admin results',
      error: error.message
    });
  }
};

const NotificationController = require('./notificationController');

const releasePendingResults = async (req, res) => {
  try {
    console.log('Release Pending Results API called');
    const { resultIds } = req.body;
    if (!resultIds || !Array.isArray(resultIds) || resultIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid resultIds provided' });
    }

    const ids = resultIds
      .filter(Boolean)
      .map(id => new mongoose.Types.ObjectId(id));

    const updateRes = await Result.updateMany(
      { _id: { $in: ids }, status: 'pending' },
      { $set: { status: 'completed', releaseTime: null } }
    );

    res.json({
      success: true,
      message: 'Results released successfully',
      matched: updateRes.matchedCount ?? updateRes.nMatched ?? 0,
      modified: updateRes.modifiedCount ?? updateRes.nModified ?? 0
    });
  } catch (error) {
    console.error('Error in releasePendingResults:', error);
    res.status(500).json({ success: false, message: 'Server error during releasing results' });
  }
};

module.exports = {
  submitQuiz,
  getUserResults,
  getResultById,
  getQuizResults,
  getLeaderboard,
  getAdminResults,
  releasePendingResults
};
