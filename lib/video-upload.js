// Browser-only: uploads a course video straight to Supabase Storage with a resumable (TUS)
// upload, so a dropped connection picks up where it stopped instead of restarting a 1 GB file.
import * as tus from "tus-js-client";
import { COURSE_VIDEO_BUCKET, materialStoragePath } from "./course-materials.js";
import { SUPABASE_URL } from "./supabase/config";

// Supabase requires 6 MB chunks for resumable uploads.
const CHUNK_SIZE = 6 * 1024 * 1024;

// The video's length in whole seconds, read from the file in the browser, or null if the
// browser can't read it (the video is still uploaded; its length just isn't shown).
export function readVideoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const finish = (value) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) && video.duration > 0 ? Math.round(video.duration) : null);
    video.onerror = () => finish(null);
    video.src = url;
  });
}

// A plain-language reason for a failed upload; tus errors are long and technical.
function uploadErrorMessage(error) {
  const status = error?.originalResponse?.getStatus?.();
  // Our own check already allows up to 2 GB, so a 413 means the Supabase project's global
  // upload limit (dashboard → Storage → Settings) is set lower than that.
  if (status === 413) return "Storage refused this file as too large. The Supabase project's upload limit is lower than 2 GB: a Supabase Owner or Administrator needs to raise it under Storage → Settings.";
  if (status === 401 || status === 403) return "You don’t have permission to upload videos, or your session has ended. Sign in again and retry.";
  if (status === 415) return "Videos must be MP4 files.";
  return "The video couldn’t be uploaded. Check your connection and try again.";
}

// Uploads one video to the course's folder in course-videos. Calls onProgress(0–100) as it
// goes. Resolves with the stored path; rejects on failure.
export async function uploadCourseVideo(supabase, courseCode, file, onProgress = () => {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Your session has ended. Sign in again, then retry.");
  const path = materialStoragePath(courseCode, file.name).replace(/course\.pdf$/, "video.mp4");

  await new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${session.access_token}`, "x-upsert": "false" },
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      chunkSize: CHUNK_SIZE,
      metadata: { bucketName: COURSE_VIDEO_BUCKET, objectName: path, contentType: "video/mp4", cacheControl: "3600" },
      onError: (error) => reject(new Error(uploadErrorMessage(error))),
      onProgress: (sent, total) => onProgress(total ? Math.round((sent / total) * 100) : 0),
      onSuccess: resolve,
    });
    // Each upload gets a new path, so there's no earlier upload to resume across page loads;
    // the retries above resume within this one after a dropped connection.
    upload.start();
  });
  return path;
}
