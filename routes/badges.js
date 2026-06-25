const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { getMyBadges } = require('../controllers/badgeController');

router.get('/my', protect, getMyBadges);

module.exports = router;
