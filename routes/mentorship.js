const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const mentorshipController = require('../controllers/mentorshipController');

router.get('/', protect, mentorshipController.getMentorshipVideos);
router.get('/admin', protect, adminOnly, mentorshipController.getMentorshipVideosAdmin);
router.post('/', protect, adminOnly, mentorshipController.createMentorshipVideo);
router.put('/:id', protect, adminOnly, mentorshipController.updateMentorshipVideo);
router.delete('/:id', protect, adminOnly, mentorshipController.deleteMentorshipVideo);
router.post('/:id/views', mentorshipController.incrementVideoViews);

module.exports = router;
