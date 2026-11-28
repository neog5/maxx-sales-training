import { ROLE_LABELS } from "./roles.js";

// Turns audit_log rows into short, readable sentences for history panels.
const FIELD_LABELS = {
  title: "title",
  description: "description",
  pass_threshold: "passing score",
  read_seconds: "reading time",
  is_active: "who can see it",
  audience: "who can see it",
  everyone_required: "who can see it",
  view_only: "no assessment",
  pdf_url: "PDF",
  name: "name",
};

export function describeAuditEntry(entry, names = {}) {
  const details = entry.details || {};
  const person = (id) => names.people?.get(id) || "a person";
  const group = (id) => names.groups?.get(id) || "a training group";
  const course = (id) => names.courses?.get(id) || "a course";
  const target = (row) => (row.group_id ? `training group “${group(row.group_id)}”` : person(row.user_id));

  switch (entry.action) {
    case "course.insert": return "Created the course";
    case "course.update": {
      // Switching a course open to everyone between required and optional (migration 019).
      const keys = Object.keys(details);
      if (keys.length === 1 && keys[0] === "everyone_required") return `Made it ${details.everyone_required.to ? "required" : "optional"} for everyone`;
      const fields = [...new Set(Object.keys(details).map((key) => FIELD_LABELS[key]).filter(Boolean))];
      return fields.length ? `Updated ${fields.join(", ")}` : "Updated the course";
    }
    case "course.archived": return "Archived the course";
    case "course.unarchived": return "Restored the course from the archive";
    case "course.delete": return `Deleted course ${details.code || ""}`.trim();
    case "course_materials.insert": return `Added ${details.kind === "video" ? "video" : "PDF deck"} “${details.title}”`;
    case "course_materials.delete": return `Removed ${details.kind === "video" ? "video" : "PDF deck"} “${details.title}”`;
    case "course_assignment.insert": return `Gave ${course(details.course_id)} to ${target(details)}${details.required === false ? " as optional" : ""}`;
    case "course_assignment.delete": return `Removed ${course(details.course_id)} from ${target(details)}`;
    case "course_assignment.update": return details.required ? `Made ${course(details.course_id)} ${details.required.to ? "required" : "optional"} for ${target(details)}` : "Updated an assignment";
    case "group.insert": return `Created training group “${details.name}”`;
    case "group.update": return details.name ? `Renamed training group to “${details.name.to}”` : "Updated the training group";
    case "group.delete": return `Deleted training group “${details.name}”`;
    case "group_member.insert": return `Added ${person(details.user_id)} to ${group(details.group_id)}`;
    case "group_member.delete": return `Removed ${person(details.user_id)} from ${group(details.group_id)}`;
    case "attempt_unlocks.insert": return `Approved more attempts for ${person(details.user_id)}`;
    case "profile.archived": return "Archived this person";
    case "profile.unarchived": return "Restored this person from the archive";
    case "invite.insert": return `Invited ${details.email}`;
    case "invite.delete": return `Withdrew the invite for ${details.email}`;
    case "profile.role_changed": return `Changed role from ${ROLE_LABELS[details.role?.from] || details.role?.from} to ${ROLE_LABELS[details.role?.to] || details.role?.to}`;
    default: return entry.action;
  }
}

// PostgREST `.or()` filter for the audit entries shown in one course's history.
export function courseHistoryFilter(courseId) {
  return [
    `and(entity_type.eq.course,entity_id.eq.${courseId})`,
    ...["course_assignment", "course_materials", "attempt_unlocks"].map((type) => `and(entity_type.eq.${type},details->>course_id.eq.${courseId})`),
  ].join(",");
}
