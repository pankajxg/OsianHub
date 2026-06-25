/**
 * Computes leaderboard summary metrics from an array of result objects.
 * @param {Array} results - Array of { score, totalQuestions }
 * @returns {{ avgScorePct, accuracyPct, attempts, composite }}
 */
function summarizeFromResults(results) {
    const attempts = results.length;
    if (attempts === 0) return { avgScorePct: 0, accuracyPct: 0, attempts: 0, composite: 0 };

    let totalPct = 0;
    let totalCorrect = 0;
    let totalQuestions = 0;

    for (const r of results) {
        const tq = r.totalQuestions || 0;
        if (tq > 0) {
            totalPct += (r.score / tq) * 100;
            totalCorrect += r.score;
            totalQuestions += tq;
        }
    }

    const avgScorePct = totalPct / attempts;
    const accuracyPct = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
    // Composite: weighted blend of avg score and attempts (capped at 100)
    const composite = Math.min(100, avgScorePct * 0.7 + Math.min(attempts * 2, 30));

    return {
        avgScorePct: Math.round(avgScorePct * 100) / 100,
        accuracyPct: Math.round(accuracyPct * 100) / 100,
        attempts,
        composite: Math.round(composite * 100) / 100,
    };
}

module.exports = { summarizeFromResults };
