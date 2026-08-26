import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuestionPerformance, gradeAssessment } from "./assessment.mjs";

test("fails an assessment when any mandatory question is incorrect", () => {
  const questions = [
    { id: "mandatory", correct_index: 0, is_mandatory: true },
    { id: "optional-1", correct_index: 0, is_mandatory: false },
    { id: "optional-2", correct_index: 0, is_mandatory: false },
    { id: "optional-3", correct_index: 0, is_mandatory: false },
    { id: "optional-4", correct_index: 0, is_mandatory: false },
  ];
  const result = gradeAssessment(questions, {
    mandatory: 1,
    "optional-1": 0,
    "optional-2": 0,
    "optional-3": 0,
    "optional-4": 0,
  }, 80);

  assert.equal(result.score, 80);
  assert.equal(result.mandatoryPassed, false);
  assert.equal(result.passed, false);
});

test("passes only when the score threshold and mandatory requirement are met", () => {
  const questions = [
    { id: "mandatory", correct_index: 0, is_mandatory: true },
    { id: "optional", correct_index: 0, is_mandatory: false },
  ];

  assert.equal(gradeAssessment(questions, { mandatory: 0, optional: 0 }, 80).passed, true);
  assert.equal(gradeAssessment(questions, { mandatory: 0, optional: 1 }, 80).passed, false);
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
