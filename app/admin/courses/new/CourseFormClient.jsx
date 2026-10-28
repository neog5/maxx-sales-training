"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FREE_PDF_PARSER_MAX_BYTES, GENERATION_LIMITS } from "@/lib/question-suggestions.mjs";
import { COURSE_PDF_BUCKET, materialStoragePath, titleFromFileName } from "@/lib/course-materials.mjs";

const initialCourse = { code: "", title: "", description: "", pass_threshold: 80, read_seconds: 60, is_active: true };
const initialRecommendationCounts = { reading: 5, main: 10 };

export default function CourseFormClient() {
  const router = useRouter();
  const supabase = createClient();
  const [course, setCourse] = useState(initialCourse);
  const [pdfs, setPdfs] = useState([]);
  const pdf = pdfs[0];
  const [recommendationCounts, setRecommendationCounts] = useState(initialRecommendationCounts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setCourse((current) => ({ ...current, [field]: value }));
  }

  async function createCourse(event) {
    event.preventDefault();
    const code = course.code.trim().toUpperCase();
    if (!code || !course.title.trim()) {
      setError("Enter a course code and title.");
      return;
    }
    if (pdfs.some((file) => file.type !== "application/pdf")) {
      setError("Please choose PDF files only.");
      return;
    }
    const readingCount = Number(recommendationCounts.reading);
    const mainCount = Number(recommendationCounts.main);
    if (pdf && !(Number.isInteger(readingCount) && readingCount >= GENERATION_LIMITS.reading.createMin && readingCount <= GENERATION_LIMITS.reading.max
      && Number.isInteger(mainCount) && mainCount >= GENERATION_LIMITS.main.createMin && mainCount <= GENERATION_LIMITS.main.max)) {
      setError(`A new course needs ${GENERATION_LIMITS.reading.createMin}–${GENERATION_LIMITS.reading.max} reading and ${GENERATION_LIMITS.main.createMin}–${GENERATION_LIMITS.main.max} main-test suggestions. You can generate more, in any amount, from the question bank later.`);
      return;
    }

    setError("");
    setSaving(true);
    const uploadedPaths = [];
    let createdId;
    try {
      const decks = [];
      for (const file of pdfs) {
        const path = materialStoragePath(code, file.name);
        const { error: uploadError } = await supabase.storage.from(COURSE_PDF_BUCKET).upload(path, file, { contentType: "application/pdf" });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        decks.push({ position: decks.length + 1, title: pdfs.length === 1 ? course.title.trim() : titleFromFileName(file.name), pdf_url: supabase.storage.from(COURSE_PDF_BUCKET).getPublicUrl(path).data.publicUrl });
      }

      const { data: created, error: insertError } = await supabase.from("courses").insert({
        ...course,
        code,
        title: course.title.trim(),
        description: course.description.trim() || null,
        pass_threshold: Number(course.pass_threshold),
        read_seconds: Number(course.read_seconds),
      }).select("id").single();
      if (insertError) throw insertError;
      createdId = created.id;
      if (decks.length) {
        const { error: deckError } = await supabase.from("course_materials").insert(decks.map((deck) => ({ ...deck, course_id: created.id })));
        if (deckError) throw deckError;
      }
      const suggestionQuery = pdf
        ? `&suggest=1&reading=${recommendationCounts.reading}&main=${recommendationCounts.main}`
        : "";
      router.push(`/admin/courses/${created.id}/questions${suggestionQuery.replace(/^&/, "?")}`);
      router.refresh();
    } catch (cause) {
      if (createdId) await supabase.from("courses").delete().eq("id", createdId);
      if (uploadedPaths.length) await supabase.storage.from(COURSE_PDF_BUCKET).remove(uploadedPaths);
      setError(cause.message || "Could not create the course. Please try again.");
      setSaving(false);
    }
  }

  return (
    <main className="tp-form-page tp-fade-in">
      <div className="tp-form-heading">
        <div className="tp-label">Admin workspace</div>
        <h1 className="tp-display">Add a course</h1>
        <p>Upload the training PDF now. We’ll prepare reading and assessment questions for you to review on the next screen.</p>
      </div>

      <form className="tp-card tp-form-card" onSubmit={createCourse}>
        <div className="tp-form-grid">
          <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Course code</div><input className="tp-input" value={course.code} placeholder="SALES-101" onChange={(e) => update("code", e.target.value)} required /></label>
          <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Course title</div><input className="tp-input" value={course.title} placeholder="Sales foundations" onChange={(e) => update("title", e.target.value)} required /></label>
        </div>
        <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Description</div><textarea className="tp-input" rows={3} value={course.description} placeholder="What learners will learn in this course." onChange={(e) => update("description", e.target.value)} /></label>
        <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Training PDFs</div><input className="tp-input" type="file" accept="application/pdf,.pdf" multiple onChange={(e) => setPdfs(Array.from(e.target.files || []))} /><div style={{ color: "var(--faint)", fontSize: 11.5, marginTop: 6 }}>Optional · Choose several PDFs for a course with more than one deck; you can rename and reorder them after the course is created. Each PDF can be up to 50 MB. Suggestions are generated from the first deck, which must be under 5 MB.</div>{pdfs.length > 1 && <ol style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--dim)" }}>{pdfs.map((file) => <li key={file.name}>{file.name}</li>)}</ol>}{pdf?.size > FREE_PDF_PARSER_MAX_BYTES && <div role="alert" style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{pdfs.length > 1 ? "The first PDF" : "This PDF"} is {(pdf.size / (1024 * 1024)).toFixed(1)} MB. AI question suggestions only work for PDFs up to 5 MB, so compress it (for example with Acrobat’s Reduce File Size) before uploading. You can still create the course and add questions manually.</div>}</label>
        {pdf && <div className="tp-form-grid tp-form-grid--equal">
          <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Reading recommendations</div><input className="tp-input" type="number" min={GENERATION_LIMITS.reading.createMin} max={GENERATION_LIMITS.reading.max} value={recommendationCounts.reading} onChange={(e) => setRecommendationCounts((current) => ({ ...current, reading: e.target.value }))} required /></label>
          <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Main-test recommendations</div><input className="tp-input" type="number" min={GENERATION_LIMITS.main.createMin} max={GENERATION_LIMITS.main.max} value={recommendationCounts.main} onChange={(e) => setRecommendationCounts((current) => ({ ...current, main: e.target.value }))} required /></label>
        </div>}
        <div className="tp-form-grid tp-form-grid--equal">
          <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Passing score (%)</div><input className="tp-input" type="number" min="0" max="100" value={course.pass_threshold} onChange={(e) => update("pass_threshold", e.target.value)} required /></label>
          <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Minimum reading time (seconds)</div><input className="tp-input" type="number" min="0" value={course.read_seconds} onChange={(e) => update("read_seconds", e.target.value)} required /></label>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 18 }}><input type="checkbox" checked={course.is_active} onChange={(e) => update("is_active", e.target.checked)} /> Make this course available to learners</label>
        <div className="tp-form-actions"><button className="tp-btn tp-btn-primary" type="submit" disabled={saving}>{saving ? "Creating…" : pdf ? "Create course and generate questions" : "Create course and add questions"}</button></div>
        {error && <div style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 10 }}>{error}</div>}
      </form>
    </main>
  );
}
