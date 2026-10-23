import test from "node:test";
import assert from "node:assert/strict";
import { getResponseText, isPdfParserSizeError, isPublicCoursePdfUrl, parseSuggestionPayload, trueFalseRange } from "./question-suggestions.mjs";

function payload(readingQuestions, mainQuestions) {
  return {
    choices: [{ message: { content: JSON.stringify({
      reading_questions: readingQuestions,
      main_questions: mainQuestions,
    }) } }],
  };
}

const readingQuestion = {
  page_number: 2,
  answer_style: "true_false",
  question_text: "The implant is sterile.",
  options: ["True", "False"],
  correct_index: 0,
  explanation: "The document identifies it as sterile.",
};

const mainQuestion = {
  answer_style: "multiple_choice",
  question_text: "Which material is specified?",
  options: ["Steel", "Titanium", "Cobalt", "Ceramic"],
  correct_index: 1,
  explanation: "Titanium is specified in the material table.",
};

test("accepts only public course PDFs on the configured Supabase origin", () => {
  const supabaseUrl = "https://example.supabase.co";
  assert.equal(isPublicCoursePdfUrl("https://example.supabase.co/storage/v1/object/public/course-pdfs/course/file.pdf", supabaseUrl), true);
  assert.equal(isPublicCoursePdfUrl("https://example.supabase.co/storage/v1/object/public/course-pdfs/", supabaseUrl), false);
  assert.equal(isPublicCoursePdfUrl("https://evil.test/storage/v1/object/public/course-pdfs/file.pdf", supabaseUrl), false);
  assert.equal(isPublicCoursePdfUrl("http://example.supabase.co/storage/v1/object/public/course-pdfs/file.pdf", supabaseUrl), false);
});

test("recognizes OpenRouter PDF parser size errors", () => {
  assert.equal(isPdfParserSizeError("Failed to parse the file: The file exceeds the maximum size supported by the file parser."), true);
  assert.equal(isPdfParserSizeError("Download exceeded 5242880 byte limit"), true);
  assert.equal(isPdfParserSizeError("Rate limit exceeded"), false);
  assert.equal(isPdfParserSizeError(undefined), false);
});

test("reads multipart model content", () => {
  assert.equal(getResponseText({ choices: [{ message: { content: [{ text: "one" }, { text: "two" }] } }] }), "onetwo");
});

test("normalizes a complete suggestion payload", () => {
  const questions = parseSuggestionPayload(payload([readingQuestion], [mainQuestion]), 1, 1);
  assert.deepEqual(questions.map(({ question_type, page_number }) => ({ question_type, page_number })), [
    { question_type: "reading_test", page_number: 2 },
    { question_type: "main_test", page_number: null },
  ]);
});

test("rejects fractional answer indexes and duplicate options", () => {
  assert.throws(
    () => parseSuggestionPayload(payload([readingQuestion], [{ ...mainQuestion, correct_index: 1.5 }]), 1, 1),
    /invalid question suggestions/
  );
  assert.throws(
    () => parseSuggestionPayload(payload([readingQuestion], [{ ...mainQuestion, options: ["Steel", "steel", "Cobalt", "Ceramic"] }]), 1, 1),
    /invalid question suggestions/
  );
});

test("accepts a top-up with no main questions and no True/False", () => {
  const questions = parseSuggestionPayload(payload([{ ...readingQuestion, answer_style: "multiple_choice", options: ["A", "B", "C", "D"] }], []), 1, 0);
  assert.equal(questions.length, 1);
});

test("requires a True/False question in larger sets and caps them at two", () => {
  const multipleChoice = { ...mainQuestion, answer_style: "multiple_choice", options: ["A", "B", "C", "D"], correct_index: 0 };
  assert.throws(() => parseSuggestionPayload(payload([], Array(5).fill(multipleChoice)), 0, 5), /True\/False/);
  const trueFalse = { ...mainQuestion, answer_style: "true_false", options: ["True", "False"], correct_index: 0 };
  assert.throws(() => parseSuggestionPayload(payload([], [trueFalse, trueFalse, trueFalse]), 0, 3), /True\/False/);
  assert.deepEqual(trueFalseRange(2), { min: 0, max: 2 });
  assert.deepEqual(trueFalseRange(15), { min: 1, max: 2 });
});

test("rejects malformed question shapes without leaking type errors", () => {
  assert.throws(
    () => parseSuggestionPayload(payload([{ ...readingQuestion, options: null }], [mainQuestion]), 1, 1),
    /invalid question suggestions/
  );
});
