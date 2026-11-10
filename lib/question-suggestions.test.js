import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GENERATION_COUNTS,
  PDF_TOO_LARGE_MESSAGE,
  buildRepairPrompt,
  buildSuggestionPrompt,
  generationCountError,
  generationCountFromParam,
  getResponseText,
  isPdfParserSizeError,
  isPublicCoursePdfUrl,
  isTrueFalse,
  openRouterRequestBody,
  parseSuggestionPayload,
  repairMessages,
  suggestionMessageContent,
  trueFalseRange,
} from "./question-suggestions.js";

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

test("validates requested suggestion counts", () => {
  assert.deepEqual(DEFAULT_GENERATION_COUNTS, { reading: 5, main: 10 });
  assert.equal(generationCountError({ reading: 5, main: 10 }), "");
  assert.equal(generationCountError({ reading: 11, main: 0 }), "Choose between 0 and 10 reading questions.");
  assert.equal(generationCountError({ reading: 0, main: 1.5 }), "Choose between 0 and 30 main-test questions.");
  assert.equal(generationCountError({ reading: 0, main: 0 }), "Choose at least one question to generate.");
  assert.match(generationCountError({ reading: 2, main: 10 }, { forNewCourse: true }), /A new course needs 3–10 reading and 5–30/);
  assert.equal(generationCountError({ reading: 3, main: 5 }, { forNewCourse: true }), "");
});

test("reads suggestion counts from URL parameters with defaults", () => {
  assert.equal(generationCountFromParam(undefined, "reading"), 5);
  assert.equal(generationCountFromParam("0", "reading"), 0);
  assert.equal(generationCountFromParam("31", "main"), 10);
  assert.equal(generationCountFromParam("abc", "main"), 10);
});

test("builds the prompt, repair request and request body", () => {
  const course = { code: "HOSP-101", title: "Hospital basics" };
  const deck = { title: "Deck one", pdf_url: "https://x/y.pdf" };
  const prompt = buildSuggestionPrompt({ course, deck, readingCount: 1, mainCount: 4 });
  assert.match(prompt, /Course: HOSP-101 — Hospital basics/);
  assert.match(prompt, /exactly 1 reading checkpoint question and exactly 4 main assessment questions/);
  assert.match(prompt, /Across all 5 questions, exactly 1 or 2 must use answer_style "true_false"/);
  assert.match(buildRepairPrompt({ readingCount: 1, mainCount: 1 }), /exactly 1 reading_questions and 1 main_questions, with at most 2 true_false/);
  const content = suggestionMessageContent({ course, deck, readingCount: 1, mainCount: 4 });
  assert.deepEqual(content[1], { type: "file", file: { filename: "HOSP-101.pdf", file_data: "https://x/y.pdf" } });
  const repair = repairMessages({ choices: [{ message: { content: "oops", annotations: [{ a: 1 }] } }] }, { readingCount: 1, mainCount: 1 });
  assert.deepEqual(repair[0], { role: "assistant", content: "oops", annotations: [{ a: 1 }] });
  assert.equal(repair[1].role, "user");
  assert.equal(repairMessages({}, { readingCount: 1, mainCount: 0 })[0].content, "I reviewed the attached course PDF.");
  const body = openRouterRequestBody({ model: "m", pdfEngine: "e", messages: [] });
  assert.deepEqual(body.plugins, [{ id: "file-parser", pdf: { engine: "e" } }]);
  assert.equal(body.stream, false);
  assert.match(PDF_TOO_LARGE_MESSAGE, /over the 5 MB limit/);
});

test("recognizes True/False questions", () => {
  assert.equal(isTrueFalse({ options: ["True", "False"] }), true);
  assert.equal(isTrueFalse({ options: ["False", "True"] }), false);
  assert.equal(isTrueFalse({ options: ["A", "B", "C", "D"] }), false);
});
