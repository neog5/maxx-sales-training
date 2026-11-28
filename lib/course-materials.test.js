import test from "node:test";
import assert from "node:assert/strict";
import { COURSE_PDF_BUCKET, COURSE_VIDEO_BUCKET, MAX_PDF_BYTES, MAX_VIDEO_BYTES, deckFileError, formatDuration, materialStoragePath, materialStoragePathFromUrl, megabytes, reorderedPositions, storedMaterialFile, titleFromFileName, uploadCourseDeck, videoFileError } from "./course-materials.js";

test("stores decks under the course code with a safe file name", () => {
  assert.equal(materialStoragePath("HOSP-101", "OR Protocols (v2).PDF", "abc"), "hosp-101/abc-or-protocols-v2-.pdf");
  assert.equal(materialStoragePath("X", "###", "abc"), "x/abc-course.pdf");
});

test("finds the bucket path of stored decks only", () => {
  assert.equal(materialStoragePathFromUrl("https://p.supabase.co/storage/v1/object/public/course-pdfs/hosp-101/a%20b.pdf"), "hosp-101/a b.pdf");
  assert.equal(materialStoragePathFromUrl("/sample-course.pdf"), null);
  assert.equal(materialStoragePathFromUrl(null), null);
});

test("turns file names into readable deck titles", () => {
  assert.equal(titleFromFileName("328-2-bloodborne_pathogens.pdf"), "328 2 bloodborne pathogens");
  assert.equal(titleFromFileName(".pdf"), "Untitled");
});

test("renumbers only the decks whose position changes", () => {
  const decks = [{ id: "a", position: 1 }, { id: "b", position: 2 }, { id: "c", position: 3 }];
  assert.deepEqual(reorderedPositions(decks, 2, 1), [{ id: "c", position: 2 }, { id: "b", position: 3 }]);
  assert.deepEqual(reorderedPositions(decks, 0, -1), []);
  // Gaps from removed decks are closed up.
  assert.deepEqual(reorderedPositions([{ id: "a", position: 1 }, { id: "c", position: 3 }], 1, 0), [{ id: "c", position: 1 }, { id: "a", position: 2 }]);
});

test("checks deck files before upload", () => {
  assert.equal(deckFileError({ name: "a.pdf", type: "application/pdf", size: 1024 }), "");
  assert.equal(deckFileError({ name: "a.png", type: "image/png", size: 1024 }), "Decks must be PDF files.");
  assert.match(deckFileError({ name: "big.pdf", type: "application/pdf", size: MAX_PDF_BYTES + 1 }), /up to 50 MB/);
  assert.equal(megabytes(1.5 * 1024 * 1024), "1.5");
});

test("uploads a deck under the course code and returns its public URL", async () => {
  const calls = [];
  const supabase = { storage: { from: (bucket) => ({
    upload: async (path, file, options) => { calls.push({ bucket, path, options }); return { error: null }; },
    getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn/${path}` } }),
  }) } };
  const { path, pdfUrl } = await uploadCourseDeck(supabase, "HOSP-101", { name: "Deck.pdf" });
  assert.match(path, /^hosp-101\/.+-deck\.pdf$/);
  assert.equal(pdfUrl, `https://cdn/${path}`);
  assert.equal(calls[0].bucket, "course-pdfs");
  const failing = { storage: { from: () => ({ upload: async () => ({ error: new Error("denied") }) }) } };
  await assert.rejects(uploadCourseDeck(failing, "X", { name: "a.pdf" }), /denied/);
});

test("videos: duration, file checks and stored file", () => {
  assert.equal(formatDuration(754), "12:34");
  assert.equal(formatDuration(3723), "1:02:03");
  assert.equal(formatDuration(5), "0:05");
  assert.equal(formatDuration(null), "");

  assert.equal(videoFileError({ name: "demo.mp4", type: "video/mp4", size: 1024 }), "");
  assert.equal(videoFileError({ name: "demo.mov", type: "video/quicktime", size: 1024 }), "Videos must be MP4 files.");
  assert.match(videoFileError({ name: "big.mp4", type: "video/mp4", size: MAX_VIDEO_BYTES + 1 }), /up to 2 GB/);

  assert.equal(titleFromFileName("Knee_Surgical-Technique.mp4"), "Knee Surgical Technique");

  assert.deepEqual(storedMaterialFile({ kind: "video", video_path: "knee/abc-demo.mp4" }), { bucket: COURSE_VIDEO_BUCKET, path: "knee/abc-demo.mp4" });
  assert.deepEqual(
    storedMaterialFile({ kind: "pdf", pdf_url: "https://x.supabase.co/storage/v1/object/public/course-pdfs/knee/a.pdf" }),
    { bucket: COURSE_PDF_BUCKET, path: "knee/a.pdf" },
  );
  assert.equal(storedMaterialFile({ kind: "pdf", pdf_url: "/sample-course.pdf" }), null);
});
