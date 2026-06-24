const Result = require('../models/Result');
const User = require('../models/User');
const LeaderboardEntry = require('../models/LeaderboardEntry');
const { summarizeFromResults } = require('../utils/leaderboard');
const jwt = require('jsonwebtoken');

function periodToDateRange(period) {
  const now = new Date();
  if (period === '7d') {
    return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
  }
  if (period === '30d') {
    return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
  }
  return { from: null, to: null };
}

async function rebuildScopeLeaderboard({ scope, scopeRef, quizId, period }) {
  const { from, to } = periodToDateRange(period);
  const match = { status: 'completed' };
  if (quizId) match.quizId = quizId;
  if (from && to) match.completedAt = { $gte: from, $lte: to };

  // Batch scope uses User.profile.year as grouping key
  let pipe = [
    { $match: match },
    {
      $group: {
        _id: '$userId',
        results: { $push: { score: '$score', totalQuestions: '$totalQuestions' } },
        attempts: { $sum: 1 }
      }
    }
  ];
  const userAgg = await Result.aggregate(pipe);
  const leaderboardDocs = [];
  for (const u of userAgg) {
    const summary = summarizeFromResults(u.results);
    leaderboardDocs.push({
      updateOne: {
        filter: {
          userId: u._id,
          scope,
          scopeRef: scope === 'batch' ? (scopeRef || null) : null,
          quizId: quizId || null,
          period
        },
        update: {
          $set: {
            userId: u._id,
            scope,
            scopeRef: scope === 'batch' ? (scopeRef || null) : null,
            quizId: quizId || null,
            period,
            avgScore: summary.avgScorePct,
            accuracy: summary.accuracyPct,
            attempts: summary.attempts,
            compositeScore: summary.composite,
            updatedAt: new Date()
          }
        },
        upsert: true
      }
    });
  }
  if (leaderboardDocs.length > 0) {
    await LeaderboardEntry.bulkWrite(leaderboardDocs, { ordered: false });
  }
}

async function getLeaderboard(req, res) {
  try {
    const scope = String(req.query.scope || 'global');
    const period = String(req.query.period || 'all');
    const quizId = req.query.quizId || null;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const batchKey = String(req.query.batchKey || '').trim();

    // Rebuild on-demand to ensure fresh stats
    await rebuildScopeLeaderboard({ scope, scopeRef: batchKey || null, quizId, period });

    const find = { scope, period };
    if (quizId) find.quizId = quizId;
    if (scope === 'batch') find.scopeRef = batchKey || null;

    const entries = await LeaderboardEntry.find(find)
      .sort({ compositeScore: -1 })
      .limit(limit)
      .populate('userId', 'name username profile');

    res.json({
      success: true,
      scope,
      period,
      leaderboard: entries.map((e, idx) => ({
        rank: idx + 1,
        user: {
          id: e.userId._id,
          name: e.userId.name,
          username: e.userId.username,
          avatar: (e.userId.profile && e.userId.profile.avatar) || ''
        },
        compositeScore: e.compositeScore,
        avgScore: e.avgScore,
        accuracy: e.accuracy,
        attempts: e.attempts
      }))
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to get leaderboard' });
  }
}

module.exports = { getLeaderboard, rebuildScopeLeaderboard };

// --- Server-Sent Events stream for realtime leaderboard ---
async function streamLeaderboard(req, res) {
  try {
    const scope = String(req.query.scope || 'global');
    const period = String(req.query.period || 'all');
    const quizId = req.query.quizId || null;
    const batchKey = String(req.query.batchKey || '').trim();
    const token = String(req.query.access_token || '');

    if (token) {
      try {
        jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-for-development');
      } catch (_) {
        // For SSE, allow anonymous access rather than closing with error
      }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let closed = false;
    req.on('close', () => { closed = true; clearInterval(timer); });

    const send = async () => {
      try {
        await rebuildScopeLeaderboard({ scope, scopeRef: scope === 'batch' ? (batchKey || null) : null, quizId, period });
        const find = { scope, period };
        if (quizId) find.quizId = quizId;
        if (scope === 'batch') find.scopeRef = batchKey || null;
        const entries = await LeaderboardEntry.find(find)
          .sort({ compositeScore: -1 })
          .limit(Math.min(parseInt(req.query.limit) || 10, 100))
          .populate('userId', 'name username profile');
        const payload = {
          type: 'leaderboard',
          leaderboard: entries.map((e, idx) => ({
            rank: idx + 1,
            user: {
              id: e.userId._id,
              name: e.userId.name,
              username: e.userId.username,
              avatar: (e.userId.profile && e.userId.profile.avatar) || ''
            },
            compositeScore: e.compositeScore,
            avgScore: e.avgScore,
            accuracy: e.accuracy,
            attempts: e.attempts
          }))
        };
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (err) {
        // Write as a soft error and keep the stream
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'update_failed' })}\n\n`);
      }
    };

    await send();
    const timer = setInterval(send, 10000);
  } catch (err) {
    try {
      res.status(500).end();
    } catch (_) {}
  }
}

module.exports.streamLeaderboard = streamLeaderboard;

