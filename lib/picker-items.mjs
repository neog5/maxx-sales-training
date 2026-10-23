import { ROLE_LABELS } from "./roles.mjs";

export function personItems(people) {
  return people.map((person) => ({
    id: person.id,
    label: person.full_name || person.email || "Unnamed",
    sublabel: person.email || ROLE_LABELS[person.role],
    keywords: ROLE_LABELS[person.role],
  }));
}

export function courseItems(courses) {
  return courses.map((course) => ({ id: course.id, label: course.title, sublabel: course.code, keywords: course.code }));
}

export function groupItems(groups) {
  return groups.map((group) => ({ id: group.id, label: group.name, sublabel: group.description || undefined }));
}
