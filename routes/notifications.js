const express = require('express');
const router = express.Router();
const { protect, superAdminOnly } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

router.get('/', protect, notificationController.getNotifications);
router.post('/send', protect, superAdminOnly, notificationController.sendNotification);
router.post('/send-result', protect, notificationController.sendResultNotification);
router.post('/read', protect, notificationController.markAsRead);

module.exports = router;
