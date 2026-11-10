// Roles control what someone can do. Which courses they must complete comes from
// groups and course assignments, so every role can also be a learner.
export const ROLES = ["learner", "manager", "admin", "super_admin"];

export const ROLE_LABELS = {
  learner: "Learner",
  manager: "Manager",
  admin: "Admin",
  super_admin: "Super admin",
};

export function isAdmin(role) {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdmin(role) {
  return role === "super_admin";
}

// Managers get read-only access to the dashboard, people and training records.
export function canViewReports(role) {
  return role === "manager" || isAdmin(role);
}

// Roles a viewer may give someone else. Only super admins grant or remove super admin.
export function assignableRoles(viewerRole, currentRole) {
  if (!isAdmin(viewerRole)) return [];
  if (isSuperAdmin(viewerRole)) return ROLES;
  if (currentRole === "super_admin") return [];
  return ROLES.filter((role) => role !== "super_admin");
}
