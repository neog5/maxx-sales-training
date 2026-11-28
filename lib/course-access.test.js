import { test } from "node:test";
import assert from "node:assert/strict";
import { courseAccess, courseAccessFields } from "./course-access.js";

test("courseAccess turns the two database fields into one choice", () => {
  assert.equal(courseAccess({ is_active: true, audience: "assigned" }), "assigned");
  assert.equal(courseAccess({ is_active: true, audience: "everyone" }), "everyone");
  assert.equal(courseAccess({ is_active: false, audience: "everyone" }), "hidden");
  assert.equal(courseAccess({ is_active: true }), "assigned");
});

test("courseAccessFields never leaves a draft open to everyone", () => {
  assert.deepEqual(courseAccessFields("assigned"), { is_active: true, audience: "assigned", everyone_required: false });
  assert.deepEqual(courseAccessFields("everyone"), { is_active: true, audience: "everyone", everyone_required: false });
  assert.deepEqual(courseAccessFields("hidden"), { is_active: false, audience: "assigned", everyone_required: false });
});

test("required for everyone only sticks to courses open to everyone", () => {
  assert.equal(courseAccessFields("everyone", true).everyone_required, true);
  assert.equal(courseAccessFields("assigned", true).everyone_required, false);
  assert.equal(courseAccessFields("hidden", true).everyone_required, false);
});
