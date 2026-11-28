import assert from "node:assert/strict";
import test from "node:test";
import { summarizeAttemptsByUser, requiredAttemptsOnly } from "./attempt-stats.js";

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

test("only attempts on required courses count", () => {
  const attempts = [
    { user_id: "u1", course_id: "req", score: 90, passed: true },
    { user_id: "u1", course_id: "opt", score: 10, passed: false },
    { user_id: "u2", course_id: "req", score: 50, passed: false },
  ];
  const kept = requiredAttemptsOnly(attempts, [{ user_id: "u1", course_id: "req" }]);
  assert.deepEqual(kept.map((attempt) => `${attempt.user_id}:${attempt.course_id}`), ["u1:req"]);
});
