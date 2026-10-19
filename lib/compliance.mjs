// A person is compliant when they have passed every course assigned to them, directly
// or through a group. Archived and hidden courses are no longer required.
export const COMPLIANCE_LABELS = {
  compliant: "Compliant",
  non_compliant: "Not compliant",
  none: "Nothing assigned",
};

export function isRequirableCourse(course) {
  return Boolean(course) && course.is_active !== false && !course.archived_at;
}

// Returns Map<userId, Set<courseId>> of the courses each person must complete.
export function requiredCoursesByUser({ assignments = [], memberships = [], courses = [] }) {
  const requirable = new Set(courses.filter(isRequirableCourse).map((course) => course.id));
  const groupMembers = new Map();
  for (const membership of memberships) {
    const members = groupMembers.get(membership.group_id) || [];
    members.push(membership.user_id);
    groupMembers.set(membership.group_id, members);
  }

  const required = new Map();
  const add = (userId, courseId) => {
    if (!requirable.has(courseId)) return;
    const courseIds = required.get(userId) || new Set();
    courseIds.add(courseId);
    required.set(userId, courseIds);
  };
  for (const assignment of assignments) {
    if (assignment.user_id) add(assignment.user_id, assignment.course_id);
    else for (const userId of groupMembers.get(assignment.group_id) || []) add(userId, assignment.course_id);
  }
  return required;
}

// Returns Map<userId, Set<courseId>> of courses with at least one passed attempt.
export function passedCoursesByUser(attempts = []) {
  const passed = new Map();
  for (const attempt of attempts) {
    if (!attempt.passed) continue;
    const courseIds = passed.get(attempt.user_id) || new Set();
    courseIds.add(attempt.course_id);
    passed.set(attempt.user_id, courseIds);
  }
  return passed;
}

export function complianceStatus(assignedCount, completedCount) {
  if (assignedCount === 0) return "none";
  return completedCount >= assignedCount ? "compliant" : "non_compliant";
}

// Builds the same map from rows of the database's required_courses() function, where
// groups are already expanded (managers can't see central group assignments).
export function requiredCoursesFromPairs(pairs = [], courses = []) {
  const requirable = new Set(courses.filter(isRequirableCourse).map((course) => course.id));
  const required = new Map();
  for (const pair of pairs) {
    if (!requirable.has(pair.course_id)) continue;
    const courseIds = required.get(pair.user_id) || new Set();
    courseIds.add(pair.course_id);
    required.set(pair.user_id, courseIds);
  }
  return required;
}

// `groups`/`memberships` here only drive filters and summaries; they can mix central
// training groups and private watchlists. Pass `requiredPairs` (from required_courses()) or
// `assignments` (expanded through `memberships`) to say who must complete what.
export function buildComplianceReport({ people = [], groups = [], memberships = [], assignments = [], requiredPairs, courses = [], attempts = [] }) {
  const required = requiredPairs
    ? requiredCoursesFromPairs(requiredPairs, courses)
    : requiredCoursesByUser({ assignments, memberships, courses });
  const passed = passedCoursesByUser(attempts);
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const groupIdsByUser = new Map();
  for (const membership of memberships) {
    const groupIds = groupIdsByUser.get(membership.user_id) || [];
    groupIds.push(membership.group_id);
    groupIdsByUser.set(membership.user_id, groupIds);
  }

  const rows = people.map((person) => {
    const requiredIds = required.get(person.id) || new Set();
    const passedIds = passed.get(person.id) || new Set();
    const outstandingCourseIds = [...requiredIds].filter((courseId) => !passedIds.has(courseId));
    const assignedCount = requiredIds.size;
    const completedCount = assignedCount - outstandingCourseIds.length;
    return {
      ...person,
      groupIds: groupIdsByUser.get(person.id) || [],
      groupNames: (groupIdsByUser.get(person.id) || []).map((groupId) => groupById.get(groupId)?.name).filter(Boolean).sort(),
      assignedCount,
      completedCount,
      outstandingCourseIds,
      status: complianceStatus(assignedCount, completedCount),
    };
  });

  const groupSummaries = groups.map((group) => {
    const members = rows.filter((row) => row.groupIds.includes(group.id));
    const withAssignments = members.filter((row) => row.status !== "none");
    const compliant = withAssignments.filter((row) => row.status === "compliant").length;
    return {
      ...group,
      memberCount: members.length,
      assessedCount: withAssignments.length,
      compliantCount: compliant,
      nonCompliantCount: withAssignments.length - compliant,
    };
  });

  return { rows, groupSummaries };
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function complianceCsv(rows, roleLabels = {}) {
  const header = ["Name", "Role", "Groups", "Completed", "Assigned", "Status"];
  const lines = rows.map((row) => [
    row.full_name,
    roleLabels[row.role] || row.role,
    row.groupNames.join("; "),
    row.completedCount,
    row.assignedCount,
    COMPLIANCE_LABELS[row.status],
  ].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\r\n");
}
