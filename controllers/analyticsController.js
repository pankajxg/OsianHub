const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Result = require('../models/Result');

async function getAdminKpis(req, res) {
  try {
    const adminId = req.user._id || req.user.id;
    const quizzes = await Quiz.find({ createdBy: adminId }).select('_id status quizType');
    const quizIds = quizzes.map(q => q._id);
    const totalQuizzesCreated = quizzes.length;
    const activeQuizzes = quizzes.filter(q => q.status === 'active').length;
    const paidQuizzes = quizzes.filter(q => q.quizType === 'paid').length;
    const totalParticipants = await Result.countDocuments({ quizId: { $in: quizIds } });
    res.json({ success: true, kpis: { totalQuizzesCreated, activeQuizzes, totalParticipants, paidQuizzes } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load admin KPIs', error: e.message });
  }
}

async function getSuperAdminKpis(req, res) {
  try {
    const now = new Date();
    const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const newUsersLast30Days = await User.countDocuments({ createdAt: { $gte: past30 } });
    const totalUsers = await User.countDocuments({});
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const totalQuizzesAttempted = await Result.countDocuments({});
    const totalQuizzes = await Quiz.countDocuments({});
    const activeQuizzes = await Quiz.countDocuments({ status: 'active' });
    const paidQuizzes = await Quiz.countDocuments({ quizType: 'paid' });
    const liveQuizzes = await Quiz.countDocuments({ quizType: 'live' });
    const activeUsersNow = await User.countDocuments({ isActive: true });
    res.json({ success: true, kpis: { newUsersLast30Days, totalUsers, totalAdmins, totalQuizzesAttempted, totalQuizzes, activeQuizzes, paidQuizzes, liveQuizzes, activeUsersNow } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load superadmin KPIs', error: e.message });
  }
}

async function getChartData(req, res) {
  try {
    const months = [];
    const userCount = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const count = await User.countDocuments({ createdAt: { $gte: start, $lt: end } });
      months.push(start.toLocaleString('default', { month: 'short' }));
      userCount.push(count);
    }

    const categoriesAgg = await Quiz.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    const labels = categoriesAgg.map(c => c._id || 'Unknown');
    const data = categoriesAgg.map(c => c.count);
    const colors = ['#3498db', '#e67e22', '#2ecc71', '#9b59b6', '#f39c12'];

    res.json({ success: true, charts: { months, userCount, categories: { labels, data, colors } } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load chart data', error: e.message });
  }
}

module.exports = { getAdminKpis, getSuperAdminKpis, getChartData };
