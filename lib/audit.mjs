// Turns audit_log rows into short, readable sentences for history panels.
const FIELD_LABELS = {
  title: "title",
  description: "description",
  pass_threshold: "passing score",
  read_seconds: "reading time",
  is_active: "visibility",
  pdf_url: "PDF",
  name: "name",
};

export function describeAuditEntry(entry, names = {}) {
  const details = entry.details || {};
  const person = (id) => names.people?.get(id) || "a person";
  const group = (id) => names.groups?.get(id) || "a group";
  const course = (id) => names.courses?.get(id) || "a course";
  const target = (row) => (row.group_id ? `group “${group(row.group_id)}”` : person(row.user_id));

  switch (entry.action) {
    case "course.insert": return "Created the course";
    case "course.update": {
      const fields = Object.keys(details).map((key) => FIELD_LABELS[key]).filter(Boolean);
      return fields.length ? `Updated ${fields.join(", ")}` : "Updated the course";
    }
    case "course.archived": return "Archived the course";
    case "course.unarchived": return "Restored the course from the archive";
    case "course.delete": return `Deleted course ${details.code || ""}`.trim();
    case "course_assignment.insert": return `Assigned ${course(details.course_id)} to ${target(details)}`;
    case "course_assignment.delete": return `Removed ${course(details.course_id)} from ${target(details)}`;
    case "group.insert": return `Created group “${details.name}”`;
    case "group.update": return details.name ? `Renamed group to “${details.name.to}”` : "Updated the group";
    case "group.delete": return `Deleted group “${details.name}”`;
    case "group_member.insert": return `Added ${person(details.user_id)} to ${group(details.group_id)}`;
    case "group_member.delete": return `Removed ${person(details.user_id)} from ${group(details.group_id)}`;
    case "profile.role_changed": return `Changed role from ${details.role?.from} to ${details.role?.to}`;
    default: return entry.action;
  }
}

export function formatAuditTime(value) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
