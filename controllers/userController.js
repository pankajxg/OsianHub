const User = require('../models/User');
const Result = require('../models/Result');
const bcrypt = require('bcryptjs');

function generateUsername(name, email) {
  const n = (name && name[0]) ? name[0].toLowerCase() : (email && email[0] ? email[0].toLowerCase() : 'u');
  const sum = (email || '').toLowerCase().split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const suffix = String(sum % 1000000).padStart(6, '0');
  return `@${n}${suffix}`;
}

const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password -otp -otpExpires')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments();

    // The frontend script (script-user-management.js) expects the user array under a 'users' key.
    res.json({
      success: true,
      users: users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNext: page * limit < totalUsers,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users',
      error: error.message
    });
  }
};

const getAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('-password -otp -otpExpires');
    res.json(admins);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ success: false, message: 'Failed to get admins', error: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -otp -otpExpires');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user', error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { name, email, role, profile } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (role && req.user && req.user.role === 'superadmin') user.role = role;
    
    if (!user.profile) {
      user.profile = {};
    }
    
    if (profile) user.profile = { ...user.profile, ...profile };

    user.updatedAt = Date.now();
    await user.save();

    const updatedUser = await User.findById(userId).select('-password -otp -otpExpires');

    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user', error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Cannot delete superadmin account' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
  }
};

const getUserStats = async (req, res) => {
  try {
    // FIX: The user ID from the auth token is in `req.user.id`.
    const userId = req.params.id || req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const totalQuizzes = await Result.countDocuments({ userId });
    const completedQuizzes = await Result.countDocuments({ userId, status: 'completed' });
    const results = await Result.find({ userId, status: 'completed' });
    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    const averageScore = completedQuizzes > 0 ? totalScore / completedQuizzes : 0;
    const passedQuizzes = results.filter(result => result.passed).length;
    const passRate = completedQuizzes > 0 ? (passedQuizzes / completedQuizzes) * 100 : 0;
    res.json({
      success: true,
      stats: {
        totalQuizzes,
        completedQuizzes,
        averageScore: Math.round(averageScore),
        passRate: Math.round(passRate),
        quizzesTaken: user.quizzesTaken.length
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user stats', error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const doc = await User.findById(req.user.id).select('-password -otp -otpExpires');
    if (!doc) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!doc.username) {
      doc.username = generateUsername(doc.name, doc.email);
      await doc.save();
    }
    if (!doc.profile) {
      doc.profile = {};
    }
    const user = doc.toObject();
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to get profile', error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, profile: profileData, profilePicture } = req.body;  // Added profilePicture

    // Prevent updating _id accidentally
    if(profileData && profileData._id) delete profileData._id;

    // Get user from DB
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Ensure the profile sub-document exists
    if (!user.profile || typeof user.profile !== 'object') {
      user.profile = {};
    }

    // Update top-level fields
    user.name = name || user.name;

    // Update nested profile fields individually
    if (profileData) {
      user.profile.age = profileData.age ?? user.profile.age;
      user.profile.college = profileData.college ?? user.profile.college;
      user.profile.course = profileData.course ?? user.profile.course;
      user.profile.year = profileData.year ?? user.profile.year;
      user.profile.state = profileData.state ?? user.profile.state;
      user.profile.city = profileData.city ?? user.profile.city;
      user.profile.phone = profileData.phone ?? user.profile.phone;
      user.profile.currentAddress = profileData.currentAddress ?? user.profile.currentAddress;
    }

    // Handle profile picture update via base64 string from req.body instead of multer file
    if (profilePicture) {
      // Check size by string length roughly (~1.25MB limit)
      if (profilePicture.length > 1310720) {
        return res.status(400).json({ success: false, message: 'Profile picture size exceeds limit of 1MB' });
      }
      user.profile.avatar = profilePicture;
    }

    await user.save();

    const updatedUser = await User.findById(req.user.id).select('-password -otp -otpExpires').lean();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { userId, newRole } = req.body;

    if (!req.user.role || req.user.role.toLowerCase() !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Only Super Admins can change user roles.' });
    }
    const validRoles = ['user', 'admin', 'superadmin'];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ success: false, message: 'Invalid role specified.' });
    }
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (targetUser.role.toLowerCase() === 'superadmin' && newRole !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot demote another Super Admin.' });
    }
    if (req.user.id.toString() === userId && newRole !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Super Admin cannot demote themselves.' });
    }
    targetUser.role = newRole;
    targetUser.updatedAt = Date.now();
    await targetUser.save();

    res.json({
      success: true,
      message: `User role updated to ${newRole} successfully.`,
      user: { _id: targetUser._id, name: targetUser.name, email: targetUser.email, role: targetUser.role }
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user role', error: error.message });
  }
};

/**
 * @desc    Activate or deactivate a user account
 * @route   PUT /api/users/status
 * @access  Superadmin
 */
const updateUserStatus = async (req, res) => {
  try {
    const { userId, isActive } = req.body;

    if (req.user.id.toString() === userId) {
      return res.status(403).json({ success: false, message: 'Forbidden: You cannot change your own status.' });
    }

    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (targetUser.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot deactivate a Super Admin account.' });
    }

    targetUser.isActive = isActive;
    await targetUser.save();

    res.json({
      success: true,
      message: `User has been successfully ${isActive ? 'activated' : 'deactivated'}.`
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user status', error: error.message });
  }
};

module.exports = {
  getUsers,
  getAdmins,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
  getProfile,
  updateProfile,
  updateUserRole,
  updateUserStatus
};
