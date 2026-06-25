const express = require('express');
const router = express.Router();
const { protect, adminOnly, superAdminOnly } = require('../middleware/auth');
const resultController = require('../controllers/resultController');

router.post('/submit', protect, resultController.submitQuiz);
router.get('/my', protect, resultController.getUserResults);
router.get('/admin', protect, adminOnly, resultController.getAdminResults);
router.post('/release', protect, adminOnly, resultController.releasePendingResults);
router.get('/quiz/:quizId', protect, adminOnly, resultController.getQuizResults);
router.get('/leaderboard/:quizId', resultController.getLeaderboard);
router.get('/:id', protect, resultController.getResultById);

module.exports = router;
