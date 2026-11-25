// Who can see a course (migration 015). The database stores two fields, `is_active` and
// `audience`; admins pick one of three plain choices instead.
export const COURSE_ACCESS = {
  assigned: {
    label: "Only the groups and people you give it to",
    hint: "Nobody else can find or open it.",
    badge: "Given to chosen groups",
  },
  everyone: {
    label: "Everyone with an account",
    hint: "Every learner sees it, including every distributor group. Only for training that’s safe for all.",
    badge: "Everyone",
  },
  hidden: {
    label: "Nobody yet (draft)",
    hint: "Only admins can see it, even if it’s been given to groups. Use this while you set it up.",
    badge: "Draft",
  },
};

export const COURSE_ACCESS_ORDER = ["assigned", "everyone", "hidden"];

export function courseAccess(course) {
  if (!course.is_active) return "hidden";
  return course.audience === "everyone" ? "everyone" : "assigned";
}

// The database fields for a choice. A draft goes back to "only the people you give it to", so
// publishing it later never opens it to everyone by accident.
export function courseAccessFields(access) {
  return { is_active: access !== "hidden", audience: access === "everyone" ? "everyone" : "assigned" };
}

export const EVERYONE_WARNING = "Make this course visible to everyone with an account? Every learner will be able to see and take it, including every distributor group.";

// Asks before opening a course to everyone. True when the change can go ahead.
export function confirmAccessChange(from, to) {
  if (to !== "everyone" || from === "everyone") return true;
  return window.confirm(EVERYONE_WARNING);
}
