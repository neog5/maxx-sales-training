import assert from "node:assert/strict";
import test from "node:test";
import { summarizeAttemptsByUser } from "./attempt-stats.js";

test("summarizes each person's completed attempts", () => {
  const statsFor = summarizeAttemptsByUser([
    { user_id: "a", score: 90, passed: true, submitted_at: "2026-01-01T00:00:00Z" },
    { user_id: "a", score: 41, passed: false, submitted_at: "2026-02-01T00:00:00Z" },
    { user_id: "b", score: 100, passed: true, submitted_at: "2026-03-01T00:00:00Z" },
  ]);
  assert.deepEqual(statsFor("a"), {
    attemptCount: 2,
    passedCount: 1,
    averageScore: 66,
    passRate: 50,
    lastActiveAt: "2026-02-01T00:00:00Z",
    attentionStatus: "needs-attention",
  });
  assert.equal(statsFor("b").attentionStatus, "on-track");
  assert.deepEqual(statsFor("nobody"), {
    attemptCount: 0,
    passedCount: 0,
    averageScore: null,
    passRate: null,
    lastActiveAt: null,
    attentionStatus: "not-started",
  });
});
