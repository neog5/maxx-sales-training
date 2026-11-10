import assert from "node:assert/strict";
import test from "node:test";
import { QUESTION_IMAGE_HINT, QUESTION_IMAGE_MAX_BYTES, questionImageError, questionImagePath, questionImagePathFromUrl, removeUnusedQuestionImage } from "./question-images.js";

const URL_BASE = "https://p.supabase.co/storage/v1/object/public/question-images/";

test("accepts only small JPEG, PNG, WebP or GIF images", () => {
  assert.equal(questionImageError(null), "");
  assert.equal(questionImageError({ type: "image/png", size: 1000 }), "");
  assert.match(questionImageError({ type: "image/svg+xml", size: 1000 }), /JPEG, PNG, WebP, or GIF image no larger than 5 MB/);
  assert.notEqual(questionImageError({ type: "image/png", size: QUESTION_IMAGE_MAX_BYTES + 1 }), "");
  assert.equal(QUESTION_IMAGE_HINT, "JPEG, PNG, WebP, or GIF · 5 MB maximum");
});

test("stores images per course and finds their path from the public URL", () => {
  assert.equal(questionImagePath("course-1", { type: "image/jpeg" }, "abc"), "course-1/abc.jpg");
  assert.equal(questionImagePathFromUrl(`${URL_BASE}course-1/abc.jpg`), "course-1/abc.jpg");
  assert.equal(questionImagePathFromUrl("https://elsewhere/x.png"), null);
  assert.equal(questionImagePathFromUrl(null), null);
});

function fakeSupabase({ snapshotCount = 0, questionCount = 0 } = {}) {
  const removed = [];
  const counts = { attempt_questions: snapshotCount, questions: questionCount };
  return {
    removed,
    from: (table) => ({ select: () => ({ eq: async () => ({ count: counts[table], error: null }) }) }),
    storage: { from: () => ({ remove: async (paths) => { removed.push(...paths); return { data: paths.map((name) => ({ name })), error: null }; } }) },
  };
}

test("removes an image only when nothing still shows it", async () => {
  const unused = fakeSupabase();
  assert.equal(await removeUnusedQuestionImage(unused, `${URL_BASE}c/a.png`), true);
  assert.deepEqual(unused.removed, ["c/a.png"]);

  const inAttempts = fakeSupabase({ snapshotCount: 2 });
  assert.equal(await removeUnusedQuestionImage(inAttempts, `${URL_BASE}c/a.png`), false);
  assert.deepEqual(inAttempts.removed, []);

  assert.equal(await removeUnusedQuestionImage(fakeSupabase(), "https://elsewhere/a.png"), false);
});
