// Roles control what someone can do. Which courses they must complete comes from
// groups and course assignments, so every role can also be a learner.
export const ROLES = ["learner", "admin", "super_admin"];

export const ROLE_LABELS = {
  learner: "Learner",
  admin: "Admin",
  super_admin: "Super admin",
};

// Admins run the portal: courses, people, training groups, the dashboard and reports.
export function isAdmin(role) {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdmin(role) {
  return role === "super_admin";
}

// Roles a viewer may give someone else. Only super admins grant or remove super admin.
export function assignableRoles(viewerRole, currentRole) {
  if (!isAdmin(viewerRole)) return [];
  if (isSuperAdmin(viewerRole)) return ROLES;
  if (currentRole === "super_admin") return [];
  return ROLES.filter((role) => role !== "super_admin");
}
