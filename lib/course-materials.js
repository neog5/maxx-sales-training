// Helpers for a course's reading materials: PDF decks (course-pdfs bucket) and videos
// (course-videos bucket, migration 014).
export const COURSE_PDF_BUCKET = "course-pdfs";
export const COURSE_VIDEO_BUCKET = "course-videos";

export const isVideo = (material) => material?.kind === "video";
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

async function signedUrls(supabase, bucket, paths, seconds) {
  const wanted = paths.filter(Boolean);
  if (!wanted.length) return new Map();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(wanted, seconds);
  return new Map((data || []).filter((entry) => entry.signedUrl).map((entry) => [entry.path, entry.signedUrl]));
}

// Both buckets are private (migrations 013 and 014), so files are opened through signed
// links that expire. Returns the materials with `pdf_url` swapped for a link that works for
// `seconds`, and videos with a `video_url`. A PDF kept outside the bucket (like the sample
// course) keeps its own address, and so does one that can't be signed, so the reader shows
// its usual "could not load" message. A video that can't be signed gets no `video_url`.
export async function withSignedMaterialUrls(supabase, materials, seconds) {
  const pdfPaths = materials.map((material) => (isVideo(material) ? null : materialStoragePathFromUrl(material.pdf_url)));
  const videoPaths = materials.map((material) => (isVideo(material) ? material.video_path : null));
  const [pdfs, videos] = await Promise.all([
    signedUrls(supabase, COURSE_PDF_BUCKET, pdfPaths, seconds),
    signedUrls(supabase, COURSE_VIDEO_BUCKET, videoPaths, seconds),
  ]);
  return materials.map((material, index) => (isVideo(material)
    ? { ...material, video_url: videos.get(videoPaths[index]) || null }
    : { ...material, pdf_url: pdfs.get(pdfPaths[index]) || material.pdf_url }));
}

// The bucket and path of a material's stored file, or null when it has none in a bucket.
export function storedMaterialFile(material) {
  if (isVideo(material)) return material.video_path ? { bucket: COURSE_VIDEO_BUCKET, path: material.video_path } : null;
  const path = materialStoragePathFromUrl(material.pdf_url);
  return path ? { bucket: COURSE_PDF_BUCKET, path } : null;
}

// Size in bytes of a stored deck, or null when the file isn't there.
export async function storedDeckSize(supabase, path) {
  const slash = path.lastIndexOf("/");
  const name = path.slice(slash + 1);
  const { data, error } = await supabase.storage.from(COURSE_PDF_BUCKET).list(slash < 0 ? "" : path.slice(0, slash), { search: name, limit: 100 });
  if (error) throw new Error(error.message);
  const file = (data || []).find((entry) => entry.name === name);
  return file ? file.metadata?.size || 0 : null;
}

// "MXO-MP00054_Surgical-Technique_R01.pdf" → "MXO MP00054 Surgical Technique R01"
export function titleFromFileName(fileName) {
  return fileName.replace(/\.(pdf|mp4)$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "Course document";
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

// Largest video the course-videos bucket accepts (migration 014).
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

// Why a chosen video file can't be uploaded, or "" when it can.
export function videoFileError(file) {
  if (file.type !== "video/mp4" && !/.mp4$/i.test(file.name)) return "Videos must be MP4 files.";
  if (file.size > MAX_VIDEO_BYTES) return `“${file.name}” is ${megabytes(file.size)} MB. Each video can be up to 2 GB.`;
  return "";
}

// 754 → "12:34"; 3723 → "1:02:03".
export function formatDuration(seconds) {
  if (!(seconds > 0)) return "";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
}

// True once playback is at (or within half a second of) the end of the video.
export function reachedEnd(currentTime, duration) {
  return duration > 0 && currentTime >= duration - 0.5;
}
