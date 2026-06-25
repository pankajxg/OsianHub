const express = require('express');
const router = express.Router();
const { protect, adminOnly, superAdminOnly } = require('../middleware/auth');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');

// Profile routes (logged-in user)
router.get('/profile', protect, userController.getProfile);
router.put('/profile', protect, userController.updateProfile);
router.post('/change-password', protect, authController.changePassword);

// Stats
router.get('/stats/:id?', protect, userController.getUserStats);

// Admin/Superadmin management routes
router.get('/', protect, adminOnly, userController.getUsers);
router.get('/admins', protect, adminOnly, userController.getAdmins);
router.get('/:id', protect, adminOnly, userController.getUserById);
router.put('/:id', protect, adminOnly, userController.updateUser);
router.delete('/:id', protect, superAdminOnly, userController.deleteUser);
router.put('/role', protect, superAdminOnly, userController.updateUserRole);
router.put('/status', protect, superAdminOnly, userController.updateUserStatus);

module.exports = router;
