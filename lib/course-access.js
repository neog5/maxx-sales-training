// Who can see a course (migration 015). The database stores two fields, `is_active` and
// `audience`; admins pick one of three plain choices instead.
export const COURSE_ACCESS = {
  assigned: {
    label: "Only the groups and people you give it to",
    hint: "Nobody else can find or open it.",
    badge: "Given to groups or people",
  },
  everyone: {
    label: "Everyone with an account",
    hint: "Every learner, in every distributor group.",
    badge: "Everyone",
  },
  hidden: {
    label: "Nobody yet (draft)",
    hint: "Only admins, while you set it up.",
    badge: "Draft",
  },
};

export const COURSE_ACCESS_ORDER = ["assigned", "everyone", "hidden"];

export function courseAccess(course) {
  if (!course.is_active) return "hidden";
  return course.audience === "everyone" ? "everyone" : "assigned";
}

// The database fields for a choice. A draft goes back to "only the people you give it to", so
// publishing it later never opens it to everyone by accident. `everyoneRequired` (migration 019)
// only applies to "everyone" and is cleared otherwise.
export function courseAccessFields(access, everyoneRequired = false) {
  return {
    is_active: access !== "hidden",
    audience: access === "everyone" ? "everyone" : "assigned",
    everyone_required: access === "everyone" && Boolean(everyoneRequired),
  };
}

export const EVERYONE_WARNING = "Show this course to every learner, in every distributor group?";

// Asks before opening a course to everyone. True when the change can go ahead.
export function confirmAccessChange(from, to) {
  if (to !== "everyone" || from === "everyone") return true;
  return window.confirm(EVERYONE_WARNING);
}
