import assert from "node:assert/strict";
import test from "node:test";
import { buildComplianceReport, complianceCsv, complianceStatus } from "./compliance.mjs";
import { assignableRoles, canViewReports, isAdmin } from "./roles.mjs";

const courses = [
  { id: "c1", is_active: true, archived_at: null },
  { id: "c2", is_active: true, archived_at: null },
  { id: "c3", is_active: true, archived_at: "2026-10-01T00:00:00Z" },
  { id: "c4", is_active: false, archived_at: null },
];
const groups = [{ id: "titan", name: "Titan Distributors" }, { id: "normal", name: "Normal Distributors" }];
const people = [
  { id: "ana", full_name: "Ana", role: "learner" },
  { id: "ben", full_name: "Ben", role: "learner" },
  { id: "cy", full_name: "Cy", role: "manager" },
];

test("combines group and individual assignments without double counting", () => {
  const { rows } = buildComplianceReport({
    people,
    groups,
    courses,
    memberships: [{ group_id: "titan", user_id: "ana" }, { group_id: "normal", user_id: "ana" }],
    assignments: [
      { course_id: "c1", group_id: "titan" },
      { course_id: "c1", group_id: "normal" },
      { course_id: "c2", user_id: "ana" },
    ],
    attempts: [{ user_id: "ana", course_id: "c1", passed: true }],
  });
  const ana = rows.find((row) => row.id === "ana");
  assert.equal(ana.assignedCount, 2);
  assert.equal(ana.completedCount, 1);
  assert.equal(ana.status, "non_compliant");
  assert.deepEqual(ana.outstandingCourseIds, ["c2"]);
  assert.deepEqual(ana.groupNames, ["Normal Distributors", "Titan Distributors"]);
});

test("archived and hidden courses are not required", () => {
  const { rows } = buildComplianceReport({
    people,
    groups,
    courses,
    memberships: [{ group_id: "titan", user_id: "ben" }],
    assignments: [{ course_id: "c3", group_id: "titan" }, { course_id: "c4", user_id: "ben" }],
    attempts: [],
  });
  assert.equal(rows.find((row) => row.id === "ben").status, "none");
});

test("failed attempts do not count and any pass completes a course", () => {
  const { rows } = buildComplianceReport({
    people,
    groups,
    courses,
    memberships: [],
    assignments: [{ course_id: "c1", user_id: "cy" }],
    attempts: [
      { user_id: "cy", course_id: "c1", passed: false },
      { user_id: "cy", course_id: "c1", passed: true },
    ],
  });
  assert.equal(rows.find((row) => row.id === "cy").status, "compliant");
});

test("group summaries count only members with assignments", () => {
  const { groupSummaries } = buildComplianceReport({
    people,
    groups,
    courses,
    memberships: [{ group_id: "titan", user_id: "ana" }, { group_id: "titan", user_id: "ben" }],
    assignments: [{ course_id: "c1", user_id: "ana" }],
    attempts: [],
  });
  const titan = groupSummaries.find((group) => group.id === "titan");
  assert.equal(titan.memberCount, 2);
  assert.equal(titan.assessedCount, 1);
  assert.equal(titan.nonCompliantCount, 1);
});

test("status thresholds", () => {
  assert.equal(complianceStatus(0, 0), "none");
  assert.equal(complianceStatus(3, 3), "compliant");
  assert.equal(complianceStatus(3, 2), "non_compliant");
});

test("CSV export escapes names and joins groups", () => {
  const csv = complianceCsv([
    { full_name: 'Doe, "JD"', role: "learner", groupNames: ["A", "B"], completedCount: 1, assignedCount: 2, status: "non_compliant" },
  ], { learner: "Learner" });
  assert.equal(csv, 'Name,Role,Groups,Completed,Assigned,Status\r\n"Doe, ""JD""",Learner,A; B,1,2,Not compliant');
});

test("role permissions", () => {
  assert.equal(canViewReports("manager"), true);
  assert.equal(canViewReports("learner"), false);
  assert.equal(isAdmin("super_admin"), true);
  assert.equal(isAdmin("manager"), false);
  assert.deepEqual(assignableRoles("admin", "learner"), ["learner", "manager", "admin"]);
  assert.deepEqual(assignableRoles("admin", "super_admin"), []);
  assert.deepEqual(assignableRoles("super_admin", "admin"), ["learner", "manager", "admin", "super_admin"]);
  assert.deepEqual(assignableRoles("manager", "learner"), []);
});
