// Helpers for a course's reading decks (PDFs in the course-pdfs bucket).
export const COURSE_PDF_BUCKET = "course-pdfs";
const PUBLIC_MARKER = `/storage/v1/object/public/${COURSE_PDF_BUCKET}/`;

export function safeFileName(name) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

// Where a newly uploaded deck is stored: one folder per course code.
export function materialStoragePath(courseCode, fileName, id = crypto.randomUUID()) {
  return `${courseCode.toLowerCase()}/${id}-${safeFileName(fileName) || "course.pdf"}`;
}

// The bucket path of a stored deck, or null for PDFs that live elsewhere (like the sample course).
export function materialStoragePathFromUrl(pdfUrl) {
  const index = pdfUrl?.indexOf(PUBLIC_MARKER) ?? -1;
  return index >= 0 ? decodeURIComponent(pdfUrl.slice(index + PUBLIC_MARKER.length)) : null;
}

// "MXO-MP00054_Surgical-Technique_R01.pdf" → "MXO MP00054 Surgical Technique R01"
export function titleFromFileName(fileName) {
  return fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "Course document";
}

// Positions to write after moving one deck, as [{ id, position }] for rows whose position changes.
export function reorderedPositions(materials, fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= materials.length || fromIndex === toIndex) return [];
  const order = [...materials];
  const [moved] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, moved);
  return order
    .map((material, index) => ({ id: material.id, position: index + 1, previous: material.position }))
    .filter((row) => row.position !== row.previous)
    .map(({ id, position }) => ({ id, position }));
}
