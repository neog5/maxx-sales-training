import assert from "node:assert/strict";
import test from "node:test";
import { courseHistoryFilter, describeAuditEntry } from "./audit.js";

test("filters a course's history to the course and rows that point at it", () => {
  const filter = courseHistoryFilter("c1");
  assert.match(filter, /^and\(entity_type\.eq\.course,entity_id\.eq\.c1\),/);
  for (const type of ["course_assignment", "course_materials", "attempt_unlocks"]) {
    assert.ok(filter.includes(`and(entity_type.eq.${type},details->>course_id.eq.c1)`));
  }
});

test("describes audit entries", () => {
  assert.equal(describeAuditEntry({ action: "course.update", details: { title: {}, read_seconds: {} } }), "Updated title, reading time");
  assert.equal(describeAuditEntry({ action: "group_member.insert", details: { user_id: "u", group_id: "g" } }, { people: new Map([["u", "Ana"]]) }), "Added Ana to a training group");
});
