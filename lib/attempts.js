// Attempt limit: a learner gets MAX_ATTEMPTS failed attempts per course. After that an admin
// must approve them, which gives a fresh set. Passing the course also resets the count.
// The database enforces the same rule in public.attempts_remaining() (migration 007).
export const MAX_ATTEMPTS = 3;

// attempts: completed attempts on one course ({ passed, submitted_at }).
// unlocks: admin approvals for that person and course ({ granted_at }).
export function attemptAllowance(attempts = [], unlocks = []) {
  const lastPass = latest(attempts.filter((attempt) => attempt.passed).map((attempt) => attempt.submitted_at));
  const lastUnlock = latest(unlocks.map((unlock) => unlock.granted_at));
  const since = Math.max(lastPass, lastUnlock);
  const failed = attempts.filter((attempt) => !attempt.passed && time(attempt.submitted_at) > since).length;
  const remaining = Math.max(0, MAX_ATTEMPTS - failed);
  return { failed, remaining, locked: remaining === 0 };
}

function time(value) {
  return value ? new Date(value).getTime() : -Infinity;
}

function latest(values) {
  return values.reduce((max, value) => Math.max(max, time(value)), -Infinity);
}
