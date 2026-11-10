// Per-person summaries of completed quiz attempts, for the People and Insights pages.

// Where someone stands, from their most recent completed attempt.
export const ATTENTION_STATUSES = ["needs-attention", "not-started", "on-track"];
export const ATTENTION_LABELS = {
  "needs-attention": "Needs attention",
  "not-started": "Not started",
  "on-track": "On track",
};

function percent(part, whole) {
  return whole ? Math.round((part / whole) * 100) : null;
}

function summarize(attempts) {
  const passedCount = attempts.filter((attempt) => attempt.passed).length;
  const latest = attempts.reduce(
    (current, attempt) => (!current || (attempt.submitted_at || "") > (current.submitted_at || "") ? attempt : current),
    null
  );
  return {
    attemptCount: attempts.length,
    passedCount,
    averageScore: attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / attempts.length) : null,
    passRate: percent(passedCount, attempts.length),
    lastActiveAt: latest?.submitted_at || null,
    attentionStatus: !latest ? "not-started" : latest.passed ? "on-track" : "needs-attention",
  };
}

// attempts: completed attempts ({ user_id, score, passed, submitted_at }), in any order.
// Returns a function giving each user's summary (an empty summary for people with none).
export function summarizeAttemptsByUser(attempts) {
  const byUser = new Map();
  for (const attempt of attempts) {
    const list = byUser.get(attempt.user_id) || [];
    list.push(attempt);
    byUser.set(attempt.user_id, list);
  }
  const summaries = new Map([...byUser].map(([userId, list]) => [userId, summarize(list)]));
  const empty = summarize([]);
  return (userId) => summaries.get(userId) || empty;
}
