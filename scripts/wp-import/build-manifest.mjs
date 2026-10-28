// Builds the course import manifest from the WordPress (LearnDash) quiz export.
//
//   node scripts/wp-import/build-manifest.mjs
//
// Reads  tmp/wp-import/quizzes.json  (exported from LearnDash's REST API)
// Writes tmp/wp-import/manifest.json and tmp/wp-import/review.csv
//
// Only courses that had a LearnDash quiz are imported. The rest are listed in
// docs/wordpress-import.md and left out for now.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("tmp/wp-import");
const PLACEHOLDER_EXPLANATION = "Review the course material for this topic.";

// One reading deck per entry. `file` is relative to tmp/wp-import/files.
// Google Slides decks (`slides`) must be downloaded as PDFs by hand and saved as `file`.
const COURSES = {
  148: { code: "KNEE-PRIMARY-TECH", title: "Freedom Primary Knee Technique", description: "This course teaches you the Freedom Primary Knee Technique.", decks: [{ title: "Freedom Primary Knee Surgical Technique", file: "148-MXO-MP00005-Freedom-Primary-Knee-Surgical-Technique_R11.pdf" }] },
  153: { code: "KNEE-PARTIAL-TECH", title: "Freedom Partial Knee Technique", description: "This course teaches you the Freedom Partial Knee Technique.", decks: [{ title: "Freedom Partial Knee Surgical Technique", file: "153-MXO-MP00054-Surgical-Technique-Freedom-Partial-Knee_R01.pdf" }] },
  157: { code: "KNEE-REVISION-TECH", title: "Revision Knee Surgical Technique", description: "This course teaches you the Freedom PCK Revision Knee Surgical Technique.", decks: [{ title: "Freedom PCK Revision Knee Surgical Technique", file: "157-MXO-MP00023-Surgical-Technique-Freedom-PCK-Revision-Knee_R07.pdf" }] },
  165: { code: "KNEE-KNOWLEDGE", title: "Freedom Knee Knowledge Base", description: "This course covers general knowledge of the Freedom Knee elements, their design, and sizing.", decks: [{ title: "Freedom Knee Knowledge Base", file: "165-freedom-knee-knowledge-base.pdf", slides: "https://docs.google.com/presentation/d/e/2PACX-1vTe0pu3cyZx0nJQ8XXx48fs76LmSFZ0mmUJ28CdIFW9R7kflMtZb_0rBysbtiGfXB7e0uZE0ll8HUB7/pub" }] },
  161: { code: "KNEE-ANATOMY", title: "Knee Anatomy and Kinematics", description: "This course teaches you the basics of Knee Anatomy and Kinematics.", decks: [{ title: "Knee Anatomy and Kinematics", file: "161-knee-anatomy-and-kinematics.pdf", slides: "https://docs.google.com/presentation/d/e/2PACX-1vSK8rC7rejVsBz0E9yFw-eYT1UgYSHvQx9gxVSUAdxp12RCdiGg6voqG9WnNz_Z2rlb8HAKPigTKNuD/pub" }] },
  359: { code: "HIP-ANATOMY", title: "Hip Anatomy", description: "This course teaches you the basics of Hip Anatomy.", decks: [{ title: "Hip Anatomy", file: "359-hip-anatomy.pdf", slides: "https://docs.google.com/presentation/d/e/2PACX-1vQzoiBJKkUCVEk24NePUYSh7W4Lz64atMbx47C9Eesn3SEMqhZfx6J9PO5_7BW6vTQ_zQo7Fmap2ZNo/pub" }] },
  379: { code: "HIP-KNOWLEDGE", title: "Libertas Hip Knowledge Base", description: "This course covers general knowledge of the Libertas Hip portfolio.", decks: [{ title: "Libertas Hip Knowledge Base", file: "379-libertas-hip-knowledge-base.pdf", slides: "https://docs.google.com/presentation/d/e/2PACX-1vSzkZ7gqwAGkgDcmRyRQuGyN8vc5D05GeB3hGsLems0NpaS6semyddGwnbD8U3hlFq5JF03E4vTHJ9H/pub" }] },
};

const quizzes = JSON.parse(fs.readFileSync(path.join(dir, "quizzes.json"), "utf8"));
const csv = [["course_code", "wp_question_id", "status", "question", "correct_answer", "options"]];
const courses = quizzes.map((quiz) => {
  const meta = COURSES[quiz.wp_id];
  if (!meta) throw new Error(`No course metadata for WordPress course ${quiz.wp_id}`);
  const seen = new Set();
  const questions = [];
  for (const [wpId, text, options, correctIndex] of quiz.questions) {
    const key = JSON.stringify([text, options]);
    const duplicate = seen.has(key);
    seen.add(key);
    csv.push([meta.code, wpId, duplicate ? "skipped: duplicate" : "import", text, options[correctIndex], options.join(" | ")]);
    if (duplicate) continue;
    questions.push({ wp_id: wpId, question_type: "main_test", question_text: text, options, correct_index: correctIndex, explanation: PLACEHOLDER_EXPLANATION, is_mandatory: false });
  }
  const decks = meta.decks.map((deck) => {
    const downloaded = fs.existsSync(path.join(dir, "files", deck.file));
    if (!downloaded && !deck.slides) throw new Error(`Missing file ${deck.file}`);
    return { ...deck, downloaded };
  });
  return {
    wp_id: quiz.wp_id,
    code: meta.code,
    title: meta.title,
    description: meta.description,
    pass_threshold: quiz.pass,
    read_seconds: 60,
    decks,
    ready: decks.every((deck) => deck.downloaded),
    questions,
  };
});

fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ built_at: new Date().toISOString(), courses }, null, 2));
const cell = (value) => `"${String(value).replaceAll('"', '""')}"`;
fs.writeFileSync(path.join(dir, "review.csv"), "\uFEFF" + csv.map((row) => row.map(cell).join(",")).join("\r\n"));

for (const course of courses) {
  console.log(`${course.code.padEnd(20)} ${String(course.questions.length).padStart(2)} questions  ${course.ready ? "ready" : "waiting for slides PDF"}`);
}
