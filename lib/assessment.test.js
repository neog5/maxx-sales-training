import assert from "node:assert/strict";
import test from "node:test";
import { attemptResult, calculateQuestionPerformance, shuffleOptions, summarizeAnswers } from "./assessment.js";

// Grading itself happens in the database (submit_attempt); npm run test:db covers it.
test("turns the database’s graded attempt into the results screen’s shape", () => {
  const result = attemptResult({
    score: 80, passed: false, total: 5, correct_count: 4, mandatory_count: 1, mandatory_correct_count: 0,
    certificate_id: null, questions: [{ id: "q1" }],
  });
  assert.deepEqual(result, {
    score: 80, passed: false, total: 5, correctCount: 4, mandatoryCount: 1, mandatoryCorrectCount: 0,
    mandatoryPassed: false, certificateId: null, questions: [{ id: "q1" }],
  });
  assert.equal(attemptResult({ mandatory_count: 0, mandatory_correct_count: 0 }).mandatoryPassed, true);
});

test("reports accuracy for mandatory, non-mandatory, image, and text-only groups", () => {
  const performance = calculateQuestionPerformance([
    { is_mandatory: true, image_url: "image.png", is_correct: true },
    { is_mandatory: true, image_url: null, is_correct: false },
    { is_mandatory: false, image_url: "image.png", is_correct: false },
    { is_mandatory: false, image_url: null, is_correct: true },
  ]);

  assert.deepEqual(
    performance.map(({ key, total, correct, accuracy }) => ({ key, total, correct, accuracy })),
    [
      { key: "mandatory", total: 2, correct: 1, accuracy: 50 },
      { key: "nonMandatory", total: 2, correct: 1, accuracy: 50 },
      { key: "imageBased", total: 2, correct: 1, accuracy: 50 },
      { key: "textOnly", total: 2, correct: 1, accuracy: 50 },
    ]
  );
});

test("shuffles options while keeping each one's original index", () => {
  const { shuffled } = shuffleOptions({ options: ["a", "b", "c"] }, () => 0);
  assert.deepEqual(shuffled.map((option) => option.originalIndex).sort(), [0, 1, 2]);
  assert.deepEqual(shuffled.find((option) => option.text === "b").originalIndex, 1);
});

test("summarizes answered questions", () => {
  assert.deepEqual(summarizeAnswers([
    { is_correct: true, is_mandatory: true },
    { is_correct: false, is_mandatory: true },
    { is_correct: true, is_mandatory: false },
  ]), { total: 3, correctCount: 2, mandatoryCount: 2, mandatoryCorrectCount: 1, mandatoryPassed: false });
});

test("works out the 60/40 assessment mix a course needs", async () => {
  const { assessmentMix } = await import("./assessment.js");
  const question = (is_mandatory) => ({ is_mandatory });
  assert.deepEqual(assessmentMix([]), { total: 0, mandatoryCount: 0, optionalCount: 0, targetCount: 5, requiredOptionalCount: 5, isShort: true });
  const sixMandatory = [...Array(6).fill(question(true)), ...Array(4).fill(question(false))];
  assert.equal(assessmentMix(sixMandatory).targetCount, 10);
  assert.equal(assessmentMix(sixMandatory).isShort, false);
  assert.equal(assessmentMix([...Array(6).fill(question(true)), ...Array(3).fill(question(false))]).isShort, true);
});
