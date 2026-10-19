// OpenRouter's free `cloudflare-ai` PDF parser rejects files over 5 MiB.
export const FREE_PDF_PARSER_MAX_BYTES = 5 * 1024 * 1024;
export const PDF_TOO_LARGE_MESSAGE = "This PDF is over the 5 MB limit for AI question suggestions. Compress it (for example with Acrobat’s Reduce File Size) and re-upload it, then try again.";

// Course creation asks for at least a full quiz (5 main) and a full reading check (3)
// so a new course is usable straight away. Later top-ups can ask for any amount.
export const GENERATION_LIMITS = {
  reading: { createMin: 3, max: 10 },
  main: { createMin: 5, max: 30 },
};

// Larger sets include 1–2 True/False questions; small top-ups may include none.
export function trueFalseRange(totalCount) {
  return { min: totalCount >= 5 ? 1 : 0, max: Math.min(2, totalCount) };
}

export function isPdfParserSizeError(message) {
  return typeof message === "string" && /exceeds the maximum size|byte limit/i.test(message);
}

export function isPublicCoursePdfUrl(pdfUrl, supabaseUrl) {
  try {
    const candidate = new URL(pdfUrl);
    const storageOrigin = new URL(supabaseUrl).origin;
    const coursePdfPrefix = "/storage/v1/object/public/course-pdfs/";

    return candidate.protocol === "https:"
      && candidate.origin === storageOrigin
      && candidate.pathname.startsWith(coursePdfPrefix)
      && candidate.pathname.length > coursePdfPrefix.length
      && !candidate.username
      && !candidate.password;
  } catch {
    return false;
  }
}

export function getResponseText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => typeof part?.text === "string" ? part.text : "").join("");
}

function cleanQuestion(question, questionType) {
  if (!question || typeof question !== "object") return null;
  if (!["multiple_choice", "true_false"].includes(question.answer_style)) return null;

  const isTrueFalse = question.answer_style === "true_false";
  if (!Array.isArray(question.options)) return null;

  const rawOptions = question.options.map((option) => typeof option === "string" ? option.trim() : "");
  const options = isTrueFalse ? ["True", "False"] : rawOptions;
  const questionText = typeof question.question_text === "string" ? question.question_text.trim() : "";
  const explanation = typeof question.explanation === "string" ? question.explanation.trim() : "";
  const correctIndex = Number(question.correct_index);
  const pageNumber = questionType === "reading_test" ? Number(question.page_number) : null;

  if (!questionText || !explanation || options.some((option) => !option)) return null;
  if (isTrueFalse && (rawOptions.length !== 2 || rawOptions[0] !== "True" || rawOptions[1] !== "False")) return null;
  if (!isTrueFalse && options.length !== 4) return null;
  if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) return null;
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return null;
  if (questionType === "reading_test" && (!Number.isInteger(pageNumber) || pageNumber < 1)) return null;

  return {
    question_type: questionType,
    page_number: pageNumber,
    question_text: questionText,
    options,
    correct_index: correctIndex,
    explanation,
  };
}

export function parseSuggestionPayload(payload, readingCount, mainCount) {
  const text = getResponseText(payload);
  if (!text) throw new Error("OpenRouter did not return any question suggestions.");

  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const objectStart = normalized.indexOf("{");
  const objectEnd = normalized.lastIndexOf("}");
  if (objectStart < 0 || objectEnd <= objectStart) throw new Error("OpenRouter did not return valid JSON.");

  let parsed;
  try {
    parsed = JSON.parse(normalized.slice(objectStart, objectEnd + 1));
  } catch {
    throw new Error("OpenRouter did not return valid JSON.");
  }

  if (!Array.isArray(parsed.reading_questions) || !Array.isArray(parsed.main_questions)) {
    throw new Error("OpenRouter did not return both question lists.");
  }
  if (parsed.reading_questions.length !== readingCount || parsed.main_questions.length !== mainCount) {
    throw new Error("OpenRouter returned an incomplete set of question suggestions.");
  }

  const questions = [
    ...parsed.reading_questions.map((question) => cleanQuestion(question, "reading_test")),
    ...parsed.main_questions.map((question) => cleanQuestion(question, "main_test")),
  ];
  if (questions.some((question) => !question)) {
    throw new Error("OpenRouter returned one or more invalid question suggestions.");
  }

  const trueFalseCount = questions.filter((question) =>
    question.options.length === 2 && question.options[0] === "True" && question.options[1] === "False"
  ).length;
  const trueFalse = trueFalseRange(readingCount + mainCount);
  if (trueFalseCount < trueFalse.min || trueFalseCount > trueFalse.max) {
    throw new Error("OpenRouter did not return the requested True/False question mix.");
  }
  return questions;
}
