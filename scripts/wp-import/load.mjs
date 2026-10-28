// Loads the WordPress courses in tmp/wp-import/manifest.json into a Supabase project.
//
//   node scripts/wp-import/load.mjs <env file>                 dry run: shows what would change
//   node scripts/wp-import/load.mjs <env file> --apply         writes it
//   node scripts/wp-import/load.mjs <env file> --apply --only KNEE-ANATOMY
//
// The env file needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Supabase →
// Project Settings → API). Courses are created hidden from learners; make each one visible
// from its admin page after checking it.
//
// Safe to rerun: courses are matched by code, decks by title and questions by text, and
// anything that already exists is left alone. Courses whose decks aren't all downloaded
// yet are skipped.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const [envFile, ...flags] = process.argv.slice(2);
if (!envFile) throw new Error("Usage: node scripts/wp-import/load.mjs <env file> [--apply] [--only CODE]");
const apply = flags.includes("--apply");
const only = flags.includes("--only") ? flags[flags.indexOf("--only") + 1] : null;

const env = Object.fromEntries(fs.readFileSync(envFile, "utf8").split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => {
  const index = line.indexOf("=");
  return [line.slice(0, index), line.slice(index + 1).trim().replace(/^"|"$/g, "")];
}));
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error(`${envFile} needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const dir = path.resolve("tmp/wp-import");
const { courses } = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const check = (result) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};

console.log(`${apply ? "Importing into" : "Dry run against"} ${new URL(env.NEXT_PUBLIC_SUPABASE_URL).host}\n`);
for (const course of courses) {
  if (only && course.code !== only) continue;
  const missing = course.decks.filter((deck) => !fs.existsSync(path.join(dir, "files", deck.file)));
  if (missing.length) {
    console.log(`${course.code}: skipped, waiting for ${missing.map((deck) => deck.file).join(", ")}`);
    continue;
  }

  let existing = check(await supabase.from("courses").select("id").eq("code", course.code).maybeSingle());
  const isNew = !existing;
  if (isNew && apply) {
    existing = check(await supabase.from("courses").insert({
      code: course.code,
      title: course.title,
      description: course.description,
      pass_threshold: course.pass_threshold,
      read_seconds: course.read_seconds,
      is_active: false,
    }).select("id").single());
  }
  const courseId = existing?.id;
  const decks = courseId ? check(await supabase.from("course_materials").select("id, title, position").eq("course_id", courseId)) : [];
  const questions = courseId ? check(await supabase.from("questions").select("question_text").eq("course_id", courseId)) : [];

  const newDecks = course.decks.filter((deck) => !decks.some((row) => row.title === deck.title));
  const knownText = new Set(questions.map((row) => row.question_text));
  const newQuestions = course.questions.filter((question) => !knownText.has(question.question_text));

  let position = Math.max(0, ...decks.map((row) => row.position));
  for (const deck of newDecks) {
    if (!apply) continue;
    const storagePath = `${course.code.toLowerCase()}/${deck.file.toLowerCase()}`;
    const bytes = fs.readFileSync(path.join(dir, "files", deck.file));
    check(await supabase.storage.from("course-pdfs").upload(storagePath, bytes, { contentType: "application/pdf", upsert: true }));
    const pdfUrl = supabase.storage.from("course-pdfs").getPublicUrl(storagePath).data.publicUrl;
    position += 1;
    check(await supabase.from("course_materials").insert({ course_id: courseId, position, title: deck.title, pdf_url: pdfUrl }));
  }
  if (apply && newQuestions.length) {
    check(await supabase.from("questions").insert(newQuestions.map(({ wp_id: _wpId, ...question }) => ({ ...question, course_id: courseId }))));
  }

  if (!isNew && !newDecks.length && !newQuestions.length) {
    console.log(`${course.code}: already imported`);
    continue;
  }
  const added = `${newDecks.length} deck${newDecks.length === 1 ? "" : "s"}, ${newQuestions.length} question${newQuestions.length === 1 ? "" : "s"}`;
  console.log(`${course.code}: ${apply ? "added" : "would add"} ${isNew ? "a hidden course, " : ""}${added}`);
}
if (!apply) console.log("\nNothing was written. Rerun with --apply to import.");
