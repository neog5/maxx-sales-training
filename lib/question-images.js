import { megabytes } from "./course-materials.js";
import { removeStoredFiles } from "./storage.js";

// Optional images on questions, stored per course in a public bucket. The bucket's own
// limits (setup.sql) match these.
export const QUESTION_IMAGE_BUCKET = "question-images";
export const QUESTION_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const QUESTION_IMAGE_EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
export const QUESTION_IMAGE_ACCEPT = Object.keys(QUESTION_IMAGE_EXTENSIONS).join(",");
export const QUESTION_IMAGE_HINT = `JPEG, PNG, WebP, or GIF · ${megabytes(QUESTION_IMAGE_MAX_BYTES)} MB maximum`;
const PUBLIC_MARKER = `/storage/v1/object/public/${QUESTION_IMAGE_BUCKET}/`;

// Why an image can't be used, or "" when it can.
export function questionImageError(file) {
  if (!file) return "";
  if (file.size > QUESTION_IMAGE_MAX_BYTES || !QUESTION_IMAGE_EXTENSIONS[file.type]) {
    return `Choose a JPEG, PNG, WebP, or GIF image no larger than ${megabytes(QUESTION_IMAGE_MAX_BYTES)} MB.`;
  }
  return "";
}

export function questionImagePath(courseId, file, id = crypto.randomUUID()) {
  return `${courseId}/${id}.${QUESTION_IMAGE_EXTENSIONS[file.type]}`;
}

// The bucket path of an uploaded image, or null for anything else.
export function questionImagePathFromUrl(imageUrl) {
  const index = imageUrl?.indexOf(PUBLIC_MARKER) ?? -1;
  return index >= 0 ? decodeURIComponent(imageUrl.slice(index + PUBLIC_MARKER.length)) : null;
}

// Uploads an image for a question in the course. Returns { path, imageUrl }; throws on failure.
export async function uploadQuestionImage(supabase, courseId, file) {
  const bucket = supabase.storage.from(QUESTION_IMAGE_BUCKET);
  const path = questionImagePath(courseId, file);
  const { error } = await bucket.upload(path, file, { contentType: file.type });
  if (error) throw new Error(`Could not upload the question image: ${error.message}`);
  return { path, imageUrl: bucket.getPublicUrl(path).data.publicUrl };
}

// Deletes an image a question no longer uses. Past attempts keep a snapshot of the image
// URL for their review pages, so the file stays while any attempt (or other question)
// still shows it. Best effort: a failure only leaves an unused file behind.
export async function removeUnusedQuestionImage(supabase, imageUrl) {
  const path = questionImagePathFromUrl(imageUrl);
  if (!path) return false;
  const [snapshots, questions] = await Promise.all([
    supabase.from("attempt_questions").select("id", { count: "exact", head: true }).eq("image_url", imageUrl),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("image_url", imageUrl),
  ]);
  if (snapshots.error || questions.error || snapshots.count || questions.count) return false;
  return removeStoredFiles(supabase, QUESTION_IMAGE_BUCKET, [path]);
}
