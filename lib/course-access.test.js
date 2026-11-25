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
  assert.deepEqual(courseAccessFields("assigned"), { is_active: true, audience: "assigned" });
  assert.deepEqual(courseAccessFields("everyone"), { is_active: true, audience: "everyone" });
  assert.deepEqual(courseAccessFields("hidden"), { is_active: false, audience: "assigned" });
});
