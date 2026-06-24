const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendResultNotification } = require('../config/nodemailer');

// Add a new method for sending cheating notifications to admin/superadmin
exports.sendCheatingNotification = async ({ userId, quizId, violationDetails }) => {
    try {
        // Find all admin and superadmin users
        const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id name email');
        if (!admins.length) {
            console.warn('No admins found for cheating notification.');
            return;
        }

        const notifications = admins.map(admin => ({
            user: admin._id,
            subject: `Cheating Alert for Quiz ID: ${quizId}`,
            message: `User ID: ${userId} has been flagged for cheating on quiz ID: ${quizId}. Details: ${JSON.stringify(violationDetails)}.`
        }));

        await Notification.insertMany(notifications);

        // Optionally notify via email if configured
        for (const admin of admins) {
            try {
                await sendResultNotification(admin.email, admin.name, `Cheating Alert - Quiz ID: ${quizId}`, `User ID: ${userId} flagged for cheating.\nDetails: ${JSON.stringify(violationDetails)}`);
            } catch (emailError) {
                console.error(`Failed to send cheating email to ${admin.email}:`, emailError);
            }
        }

        console.log(`Cheating notifications sent to ${admins.length} admins/superadmins.`);

    } catch (error) {
        console.error('Error sending cheating notification:', error);
    }
};

/**
 * @desc    Send a notification to users/admins
 * @route   POST /api/notifications/send
 * @access  Private (Superadmin)
 */
exports.sendNotification = async (req, res) => {
    try {
        const { recipient, subject, message } = req.body;

        if (!recipient || !subject || !message) {
            return res.status(400).json({ message: 'Recipient, subject, and message are required.' });
        }

        let query = {};
        if (recipient === 'users') {
            query = { role: 'user' };
        } else if (recipient === 'admins') {
            query = { role: { $in: ['admin', 'superadmin'] } };
        }
        // 'all' means an empty query, which finds everyone.

        const targetUsers = await User.find(query).select('_id');

        if (targetUsers.length === 0) {
            return res.status(404).json({ message: 'No recipients found for the selected group.' });
        }

        const notifications = targetUsers.map(user => ({
            user: user._id,
            subject,
            message
        }));

        await Notification.insertMany(notifications);

        res.status(201).json({ message: `Notification sent successfully to ${targetUsers.length} recipients.` });

    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ message: 'Server error while sending notification.' });
    }
};

/**
 * @desc    Get notifications for the logged-in user
 * @route   GET /api/notifications
 * @access  Private (All logged-in users)
 */
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 0; // 0 means no limit

        const notifications = await Notification.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(limit);

        res.status(200).json(notifications);

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Server error while fetching notifications.' });
    }
};

/**
 * @desc    Mark notifications as read
 * @route   POST /api/notifications/read
 * @access  Private (User)
 */
exports.markAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const { notificationIds } = req.body; // Expects an array of notification IDs

        if (!notificationIds || !Array.isArray(notificationIds)) {
            return res.status(400).json({ message: 'notificationIds must be an array.' });
        }

        const result = await Notification.updateMany(
            { _id: { $in: notificationIds }, user: userId }, // Security check: only update user's own notifications
            { $set: { isRead: true } }
        );

        if (result.nModified === 0) {
            return res.status(404).json({ message: 'No matching notifications found to update.' });
        }

        res.status(200).json({ message: 'Notifications marked as read.' });

    } catch (error) {
        console.error('Error marking notifications as read:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

/**
 * @desc    Send custom notification to selected users with result info
 * @route   POST /api/notifications/send-result
 * @access  Private (Admin)
 */
exports.sendResultNotification = async (req, res) => {
    try {
        const { userIds, subject, message, resultLink } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !message) {
            return res.status(400).json({ message: 'userIds (non-empty array) and message are required.' });
        }

        // Validate that all userIds are valid ObjectIds
        const mongoose = require('mongoose');
        const invalidIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            return res.status(400).json({ message: `Invalid user IDs: ${invalidIds.join(', ')}` });
        }

        const defaultSubject = subject || 'Quiz Result Notification';

        const targetUsers = await User.find({ _id: { $in: userIds } }).select('_id name email');

        if (targetUsers.length === 0) {
            return res.status(404).json({ message: 'No recipients found.' });
        }

        // Create notifications
        const notifications = targetUsers.map(user => ({
            user: user._id,
            subject: defaultSubject,
            message
        }));

        await Notification.insertMany(notifications);

        // Send emails if configured
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            for (const user of targetUsers) {
                try {
                    await sendResultNotification(user.email, user.name, defaultSubject, message, resultLink);
                } catch (emailError) {
                    console.error(`Failed to send email to ${user.email}:`, emailError);
                }
            }
        }

        res.status(201).json({ message: `Notifications sent successfully to ${targetUsers.length} recipients.` });

    } catch (error) {
        console.error('Error sending result notification:', error);
        res.status(500).json({ message: 'Server error while sending notifications.' });
    }
};
