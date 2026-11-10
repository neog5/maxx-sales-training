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

// Largest deck the course-pdfs bucket accepts.
export const MAX_PDF_BYTES = 50 * 1024 * 1024;

// 5242880 → "5", 1572864 → "1.5": megabytes for messages.
export function megabytes(bytes) {
  return String(Math.round((bytes / (1024 * 1024)) * 10) / 10);
}

// Why a chosen deck file can't be uploaded, or "" when it can.
export function deckFileError(file) {
  if (file.type !== "application/pdf") return "Decks must be PDF files.";
  if (file.size > MAX_PDF_BYTES) return `“${file.name}” is ${megabytes(file.size)} MB. Each PDF can be up to ${megabytes(MAX_PDF_BYTES)} MB.`;
  return "";
}

// Uploads one deck PDF to the course's folder. Returns { path, pdfUrl }; throws on failure.
export async function uploadCourseDeck(supabase, courseCode, file) {
  const bucket = supabase.storage.from(COURSE_PDF_BUCKET);
  const path = materialStoragePath(courseCode, file.name);
  const { error } = await bucket.upload(path, file, { contentType: "application/pdf" });
  if (error) throw error;
  return { path, pdfUrl: bucket.getPublicUrl(path).data.publicUrl };
}
