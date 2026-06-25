const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getLeaderboard, streamLeaderboard } = require('../controllers/leaderboardController');

router.get('/', protect, getLeaderboard);
router.get('/stream', streamLeaderboard);

module.exports = router;
