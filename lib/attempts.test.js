import test from "node:test";
import assert from "node:assert/strict";
import { MAX_ATTEMPTS, attemptAllowance } from "./attempts.js";

const fail = (day) => ({ passed: false, submitted_at: `2026-11-0${day}T10:00:00Z` });
const pass = (day) => ({ passed: true, submitted_at: `2026-11-0${day}T10:00:00Z` });

test("a new learner has every attempt available", () => {
  assert.deepEqual(attemptAllowance([], []), { failed: 0, remaining: MAX_ATTEMPTS, locked: false });
});

test("three failures lock the assessment", () => {
  assert.equal(attemptAllowance([fail(1), fail(2)]).remaining, 1);
  assert.deepEqual(attemptAllowance([fail(1), fail(2), fail(3)]), { failed: 3, remaining: 0, locked: true });
});

test("an admin approval gives a fresh set of attempts", () => {
  const attempts = [fail(1), fail(2), fail(3)];
  assert.equal(attemptAllowance(attempts, [{ granted_at: "2026-11-04T09:00:00Z" }]).remaining, MAX_ATTEMPTS);
  assert.equal(attemptAllowance([...attempts, fail(5)], [{ granted_at: "2026-11-04T09:00:00Z" }]).remaining, MAX_ATTEMPTS - 1);
});

test("an approval granted before the failures does not count", () => {
  assert.equal(attemptAllowance([fail(2), fail(3), fail(4)], [{ granted_at: "2026-11-01T09:00:00Z" }]).locked, true);
});

test("passing resets the count", () => {
  assert.equal(attemptAllowance([fail(1), fail(2), pass(3)]).remaining, MAX_ATTEMPTS);
  assert.equal(attemptAllowance([fail(1), fail(2), pass(3), fail(4)]).remaining, MAX_ATTEMPTS - 1);
});
