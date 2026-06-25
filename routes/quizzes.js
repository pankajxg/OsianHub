const express = require('express');
const router = express.Router();
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const quizController = require('../controllers/quizController');

// Public / optional auth routes
router.get('/', optionalAuth, quizController.getQuizzes);
router.get('/categories', quizController.getCategories);

// Admin routes
router.post('/', protect, adminOnly, quizController.createQuiz);
router.get('/admin', protect, adminOnly, quizController.getAdminQuizzes);

// User routes
router.get('/user/registered', protect, quizController.getUserRegisteredQuizzes);

// Single quiz
router.get('/:id', protect, quizController.getQuizById);
router.put('/:id', protect, adminOnly, quizController.updateQuiz);
router.delete('/:id', protect, adminOnly, quizController.deleteQuiz);
router.get('/:id/stats', protect, adminOnly, quizController.getQuizStats);

module.exports = router;
