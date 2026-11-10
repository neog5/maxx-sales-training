// Small helpers for showing people. `full_name` can be empty for brand-new sign-ups.

export function displayName(person) {
  return person?.full_name?.trim() || person?.email || "Unnamed";
}

// The letter shown in avatar circles.
export function initial(name) {
  return name?.trim()?.charAt(0)?.toUpperCase() || "U";
}

export function firstName(name, fallback = "there") {
  return name?.trim()?.split(/\s+/)[0] || fallback;
}

// Sort comparator by name that tolerates missing names.
export function byName(a, b) {
  return (a.full_name || "").localeCompare(b.full_name || "");
}
