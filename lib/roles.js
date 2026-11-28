// Roles control what someone can do. Which courses they must complete comes from
// groups and course assignments, so every role can also be a learner.
export const ROLES = ["learner", "admin", "super_admin"];

// People only ever see two roles, Learner and Admin. A super admin (who can also delete
// courses and archive admins) is shown as "Admin"; the difference stays internal.
export const VISIBLE_ROLES = ["learner", "admin"];

export const ROLE_LABELS = {
  learner: "Learner",
  admin: "Admin",
  super_admin: "Admin",
};

// The role as people see it: "learner" or "admin".
export function visibleRole(role) {
  return isAdmin(role) ? "admin" : role;
}

// Admins run the portal: courses, people, training groups, the dashboard and reports.
export function isAdmin(role) {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdmin(role) {
  return role === "super_admin";
}

// Roles a viewer may pick for someone else: Learner and Admin. Super admin is never offered
// (it's granted directly in the database); a super admin keeps their role in the list so the
// picker shows it, and only another super admin can change it.
export function assignableRoles(viewerRole, currentRole) {
  if (!isAdmin(viewerRole)) return [];
  if (currentRole === "super_admin") return isSuperAdmin(viewerRole) ? ["learner", "super_admin"] : [];
  return VISIBLE_ROLES;
}
