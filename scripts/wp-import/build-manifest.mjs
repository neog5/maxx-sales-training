// Builds the course import manifest from the WordPress (LearnDash) quiz export.
//
//   node scripts/wp-import/build-manifest.mjs
//
// Reads  tmp/wp-import/quizzes.json  (exported from LearnDash's REST API)
// Writes tmp/wp-import/manifest.json and tmp/wp-import/review.csv
//
// Courses that had a LearnDash quiz are imported with their questions; the rest are
// imported as view-only courses (see VIEW_ONLY_COURSES).
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

// View-only courses had no LearnDash quiz: reading them completes them and issues the
// certificate. Business Conduct Standards (WP 202) is left out, since it had no reading material.
const VIEW_ONLY_COURSES = {
  348: { code: "HIP-CUP-TECH", title: "Libertas Acetabular Cup Surgical Technique", description: "Read the Libertas Acetabular Cup surgical technique.", decks: [{ title: "Libertas Acetabular Cup Surgical Technique", file: "348-MXO_LH00004_R03_LibertasAcetabularCup_SurgicalTechnique_22jul2022_web.pdf" }] },
  352: { code: "HIP-HA-STEM-TECH", title: "Libertas HA Uncemented Stem", description: "Read the Libertas HA uncemented stem surgical technique.", decks: [{ title: "Libertas HA Uncemented Stem Surgical Technique", file: "352-MXO_LH00007_R03_LibertasHipUncem_SurgicalTechnique_22jul2022_web.pdf" }] },
  356: { code: "HIP-TR-STEM-TECH", title: "Libertas TR Stem Surgical Technique", description: "Read the Libertas TR stem surgical technique.", decks: [{ title: "Libertas TR Stem Surgical Technique", file: "356-MXO_LH00019_R01_LibertasTRStem_SurgTech_04may2022_WEB.pdf" }] },
  169: { code: "KNEE-PCK-TECH", title: "Freedom Primary PCK Technique", description: "Read the Freedom Primary PCK surgical technique.", decks: [{ title: "Freedom Primary PCK Surgical Technique", file: "169-MXO-MP00067-Surgical-Technique-Freedom-Primary-PCK_R02.pdf" }] },
  185: { code: "TERRITORY-MAP", title: "Sales Territory Map", description: "Review the current sales territory map.", decks: [{ title: "Sales Territory Map", file: "185-sales-territory-map.pdf" }] },
  175: { code: "MECH-PROPERTIES", title: "Mechanical Properties and Wear", description: "Review the mechanical properties and wear of implant materials.", decks: [{ title: "Mechanical Properties and Wear", file: "175-mechanical-properties.pdf", slides: "https://docs.google.com/presentation/d/e/2PACX-1vTiw6cf68duu0CKzQl1R8HS_j7eBBatZiLPvCZwT6rsvailU8IkNPPiQdLrV3DzMa8eZKw-yfu9uQh7/pub" }] },
  207: { code: "COMPLAINT-HANDLING", title: "Complaint Handling", description: "Learn how product complaints are handled.", decks: [{ title: "Complaint Handling", file: "207-complaint-handling.pdf", slides: "https://docs.google.com/presentation/d/e/2PACX-1vQu84aHJ8hXj3MEWDu8AS8XBUWhONUlc6UVhCBLs_1pvU-H1onGfIz8zYvgg0NNRNqvF8kMMN6Srz2L/pub" }] },
  180: { code: "TRAVEL-EXPENSE", title: "Employee Travel & Expense", description: "Review the employee travel and expense policy.", decks: [{ title: "Employee Travel & Expense", file: "180-employee-travel-expense.pdf", slides: "https://docs.google.com/presentation/d/e/2PACX-1vR27TI9K0rAA4UnN-2GaiMAcr2vbCpecqablJ7nkJFhrA1nq6LStxKKzqHaFVMEoJp-PjeoBEUN36Ry/pub" }] },
  328: { code: "HOSPITAL-PROTOCOL", title: "Hospital Protocol", description: "Review aseptic technique, bloodborne pathogens, HIPAA and OR protocols.", decks: [{ title: "Aseptic Techniques", file: "328-1-aseptic-techniques.pdf", slides: "https://docs.google.com/presentation/d/e/2PACX-1vSIc21bwI6lpfwWmJMT9o6AtnHtFzvPabMbI5z8-tW0UAkJIH7vyYjj-AihxdsiXBdt03a2xXvvk3wM/pub" }, { title: "Bloodborne Pathogens", file: "328-2-bloodborne-pathogens.pdf", slides: "https://docs.google.com/presentation/d/e/2PACX-1vTGl258ccrF5fWGeUz1rMbz9wB5ogRfa5zRskCXVbHkTBJx3LiVKYVTsczq0VyePWWZnKNpgtJEnPDo/pub" }, { title: "HIPAA", file: "328-3-hipaa.pdf", slides: "https://docs.google.com/presentation/d/e/2PACX-1vT3eKUoU44Fi7JNxRXWs8Vpphj5ZnZSSsQK6RuLwnRzy40qmqQCSf6XVlTA0CpjiAvXofm7Pa2F0_Y9/pub" }, { title: "OR Protocols", file: "328-4-or-protocols.pdf", slides: "https://docs.google.com/presentation/d/e/2PACX-1vRYkWecHVbUoIYGYmTvGL39-V_y9m6YwE9zhIcJs-BK2_QmmkqZb8hjgV6aNtXfimCp9O8K3xX9OgnP/pub" }] },
  337: { code: "SAFETY", title: "Safety", description: "Review electrical safety, fire safety and the National Patient Safety Goals.", decks: [{ title: "Electrical Safety", file: "337-1-electrical-safety.pdf", slides: "https://docs.google.com/presentation/d/e/2PACX-1vRRzp-7YftZScu8DJbtLz_WcFrmhCfbBfRfHieY4AgTM-gyKuADejmgoBbK-ESQ_zQhNCoXZK9bkb8b/pub" }, { title: "Fire Safety", file: "337-2-fire-safety.pdf", slides: "https://docs.google.com/presentation/d/e/2PACX-1vSpHM2FSSlPXosa8XnLtpo1QjMtJUjUT3znHs3Kdl6OkglGtWr3ROparydGytNbRmLn0BgxuBUkWzVW/pub" }, { title: "National Patient Safety Goals", file: "337-3-national-patient-safety-goals.pdf", slides: "https://docs.google.com/presentation/d/e/2PACX-1vQkheDCG_fS9eC0L6a5d9GpT4izzJNIVRlAHt9qo_fC_4VEGniGpcElGloPIkOl4fnbHdKGp_2G6U6L/pub" }] },
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
  return course(quiz.wp_id, meta, { pass_threshold: quiz.pass, view_only: false, questions });
});
for (const [wpId, meta] of Object.entries(VIEW_ONLY_COURSES)) {
  courses.push(course(Number(wpId), meta, { pass_threshold: 80, view_only: true, questions: [] }));
}

function course(wpId, meta, extra) {
  const decks = meta.decks.map((deck) => {
    const downloaded = fs.existsSync(path.join(dir, "files", deck.file));
    if (!downloaded && !deck.slides) throw new Error(`Missing file ${deck.file}`);
    return { ...deck, downloaded };
  });
  return {
    wp_id: wpId,
    code: meta.code,
    title: meta.title,
    description: meta.description,
    read_seconds: 60,
    decks,
    ready: decks.every((deck) => deck.downloaded),
    ...extra,
  };
}

fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ built_at: new Date().toISOString(), courses }, null, 2));
const cell = (value) => `"${String(value).replaceAll('"', '""')}"`;
fs.writeFileSync(path.join(dir, "review.csv"), "\uFEFF" + csv.map((row) => row.map(cell).join(",")).join("\r\n"));

for (const course of courses) {
  const kind = course.view_only ? "view only   " : `${String(course.questions.length).padStart(2)} questions`;
  console.log(`${course.code.padEnd(20)} ${kind}  ${course.ready ? "ready" : `waiting for ${course.decks.filter((deck) => !deck.downloaded).length} slides PDF(s)`}`);
}
