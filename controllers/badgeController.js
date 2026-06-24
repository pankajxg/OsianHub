const Result = require('../models/Result');
const User = require('../models/User');
const Badge = require('../models/Badge');
const UserBadge = require('../models/UserBadge');

async function ensureDefaultBadges() {
  const defaults = [
    { code: 'top1pct_monthly', name: 'Top 1% (Monthly)', description: 'Ranked in top 1% this month', icon: '🏆' },
    { code: 'five_passed', name: '5 Quizzes Passed', description: 'Passed 5 quizzes overall', icon: '✅' },
    { code: 'streak_7', name: '7-Day Streak', description: 'Completed quizzes 7 days in a row', icon: '🔥' }
  ];
  for (const b of defaults) {
    await Badge.updateOne({ code: b.code }, { $set: b }, { upsert: true });
  }
}

async function awardBadgesForUser(userId) {
  await ensureDefaultBadges();

  // Five passed
  const passedCount = await Result.countDocuments({ userId, status: 'completed', passed: true });
  if (passedCount >= 5) {
    await UserBadge.updateOne({ userId, badgeCode: 'five_passed' }, { $set: { userId, badgeCode: 'five_passed', earnedAt: new Date(), meta: { passedCount } } }, { upsert: true });
  }

  // Streak 7: completed in last 7 consecutive days
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  let streak = 0;
  for (let d = 0; d < 7; d++) {
    const start = new Date(now.getTime() - d * dayMs);
    start.setHours(0,0,0,0);
    const end = new Date(start.getTime() + dayMs - 1);
    const has = await Result.exists({ userId, status: 'completed', completedAt: { $gte: start, $lte: end } });
    if (has) streak++; else break;
  }
  if (streak >= 7) {
    await UserBadge.updateOne({ userId, badgeCode: 'streak_7' }, { $set: { userId, badgeCode: 'streak_7', earnedAt: new Date(), meta: { streak } } }, { upsert: true });
  }

  // Top 1% monthly: compute percentile from LeaderboardEntry period=30d global
  try {
    const LeaderboardEntry = require('../models/LeaderboardEntry');
    const entries = await LeaderboardEntry.find({ scope: 'global', period: '30d' }).sort({ compositeScore: -1 });
    if (entries.length > 0) {
      const topN = Math.max(1, Math.floor(entries.length * 0.01));
      const eligible = entries.slice(0, topN).some(e => String(e.userId) === String(userId));
      if (eligible) {
        await UserBadge.updateOne({ userId, badgeCode: 'top1pct_monthly' }, { $set: { userId, badgeCode: 'top1pct_monthly', earnedAt: new Date(), meta: { total: entries.length } } }, { upsert: true });
      }
    }
  } catch (_) {}
}

async function getMyBadges(req, res) {
  try {
    await ensureDefaultBadges();
    const userId = req.user.id;
    const badges = await UserBadge.find({ userId }).sort({ earnedAt: -1 });
    const catalog = await Badge.find({ active: true }).lean();
    const byCode = Object.fromEntries(catalog.map(b => [b.code, b]));
    res.json({ success: true, badges: badges.map(b => ({ code: b.badgeCode, name: byCode[b.badgeCode]?.name || b.badgeCode, description: byCode[b.badgeCode]?.description || '', icon: byCode[b.badgeCode]?.icon || '', earnedAt: b.earnedAt, meta: b.meta })) });
  } catch (err) {
    console.error('Get badges error:', err);
    res.status(500).json({ success: false, message: 'Failed to get badges' });
  }
}

module.exports = { awardBadgesForUser, getMyBadges, ensureDefaultBadges };

