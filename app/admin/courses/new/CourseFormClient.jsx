"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Notice from "@/components/Notice";
import { COURSE_PDF_BUCKET, MAX_PDF_BYTES, deckFileError, megabytes, titleFromFileName, uploadCourseDeck } from "@/lib/course-materials";
import { friendlyDbError } from "@/lib/db";
import {
  DEFAULT_GENERATION_COUNTS,
  FREE_PDF_PARSER_LIMIT_TEXT,
  FREE_PDF_PARSER_MAX_BYTES,
  GENERATION_LIMITS,
  generationCountError,
} from "@/lib/question-suggestions";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";
import { removeStoredFiles } from "@/lib/storage";

const initialCourse = { code: "", title: "", description: "", pass_threshold: 80, read_seconds: 60, is_active: true, view_only: false };

function CountField({ label, kind, value, onChange }) {
  const limits = GENERATION_LIMITS[kind];
  return (
    <label className="tp-form-field">
      <div className="tp-label form-label">{label}</div>
      <input className="tp-input" type="number" min={limits.createMin} max={limits.max} value={value} onChange={(event) => onChange(kind, event.target.value)} required />
    </label>
  );
}

export default function CourseFormClient() {
  const router = useRouter();
  const supabase = createClient();
  const [course, setCourse] = useState(initialCourse);
  const [pdfs, setPdfs] = useState([]);
  const [counts, setCounts] = useState(DEFAULT_GENERATION_COUNTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Suggestions are generated from the first deck, which the free PDF parser must accept.
  const pdf = pdfs[0];
  const pdfTooLargeForSuggestions = pdf?.size > FREE_PDF_PARSER_MAX_BYTES;
  const suggest = Boolean(pdf) && !course.view_only && !pdfTooLargeForSuggestions;

  function update(field, value) {
    setCourse((current) => ({ ...current, [field]: value }));
  }

  function updateCount(kind, value) {
    setCounts((current) => ({ ...current, [kind]: value }));
  }

  // Uploads every chosen PDF and returns the deck rows to insert, plus the stored paths.
  async function uploadDecks(code) {
    const decks = [];
    const paths = [];
    try {
      for (const file of pdfs) {
        const { path, pdfUrl } = await uploadCourseDeck(supabase, code, file);
        paths.push(path);
        decks.push({ position: decks.length + 1, title: pdfs.length === 1 ? course.title.trim() : titleFromFileName(file.name), pdf_url: pdfUrl });
      }
    } catch (uploadError) {
      await removeStoredFiles(supabase, COURSE_PDF_BUCKET, paths);
      throw uploadError;
    }
    return { decks, paths };
  }

  function nextPage(courseId) {
    if (course.view_only) return routes.adminCourse(courseId);
    if (!suggest) return routes.adminCourseQuestions(courseId);
    const params = new URLSearchParams({ suggest: "1", reading: String(counts.reading), main: String(counts.main) });
    return `${routes.adminCourseQuestions(courseId)}?${params}`;
  }

  async function createCourse(event) {
    event.preventDefault();
    const code = course.code.trim().toUpperCase();
    if (!code || !course.title.trim()) {
      setError("Enter a course code and title.");
      return;
    }
    const fileError = pdfs.map(deckFileError).find(Boolean);
    if (fileError) {
      setError(fileError);
      return;
    }
    if (suggest) {
      const countError = generationCountError({ reading: Number(counts.reading), main: Number(counts.main) }, { forNewCourse: true });
      if (countError) {
        setError(countError);
        return;
      }
    }

    setError("");
    setSaving(true);
    let uploadedPaths = [];
    let createdId;
    try {
      const { decks, paths } = await uploadDecks(code);
      uploadedPaths = paths;

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
      router.push(nextPage(created.id));
      router.refresh();
    } catch (cause) {
      if (createdId) await supabase.from("courses").delete().eq("id", createdId);
      await removeStoredFiles(supabase, COURSE_PDF_BUCKET, uploadedPaths);
      setError(friendlyDbError(cause, { duplicate: `A course with the code ${code} already exists.`, fallback: cause?.message || "Could not create the course. Please try again." }));
      setSaving(false);
    }
  }

  return (
    <main className="tp-form-page tp-fade-in">
      <div className="tp-form-heading">
        <h1 className="tp-display">Add a course</h1>
        <p>Upload the PDF and you’ll review suggested questions on the next screen.</p>
      </div>

      <form className="tp-card tp-form-card" onSubmit={createCourse}>
        <div className="tp-form-grid">
          <label className="tp-form-field"><div className="tp-label form-label">Course code</div><input className="tp-input" value={course.code} placeholder="SALES-101" onChange={(event) => update("code", event.target.value)} required /></label>
          <label className="tp-form-field"><div className="tp-label form-label">Course title</div><input className="tp-input" value={course.title} placeholder="Sales foundations" onChange={(event) => update("title", event.target.value)} required /></label>
        </div>
        <label className="tp-form-field"><div className="tp-label form-label">Description</div><textarea className="tp-input" rows={3} value={course.description} placeholder="What learners will learn in this course." onChange={(event) => update("description", event.target.value)} /></label>
        <label className="tp-form-field">
          <div className="tp-label form-label">Training PDFs</div>
          <input className="tp-input" type="file" accept="application/pdf,.pdf" multiple onChange={(event) => setPdfs(Array.from(event.target.files || []))} />
          <div className="form-hint">
            Optional. Up to {megabytes(MAX_PDF_BYTES)} MB each; pick several for a multi-deck course. Suggestions use the first PDF, which must be under {FREE_PDF_PARSER_LIMIT_TEXT}.
          </div>
          {pdfs.length > 1 && <ol className="form-file-list">{pdfs.map((file) => <li key={file.name}>{file.name}</li>)}</ol>}
          {pdfTooLargeForSuggestions && (
            <div role="alert" className="form-error">
              {pdfs.length > 1 ? "The first PDF" : "This PDF"} is {megabytes(pdf.size)} MB. AI question suggestions only work for PDFs up to {FREE_PDF_PARSER_LIMIT_TEXT}, so compress it (for example with Acrobat’s Reduce File Size) before uploading. You can still create the course and add questions manually.
            </div>
          )}
        </label>
        {suggest && (
          <div className="tp-form-grid tp-form-grid--equal">
            <CountField label="Reading recommendations" kind="reading" value={counts.reading} onChange={updateCount} />
            <CountField label="Main-test recommendations" kind="main" value={counts.main} onChange={updateCount} />
          </div>
        )}
        <label className="check-row"><input type="checkbox" checked={course.view_only} onChange={(event) => update("view_only", event.target.checked)} /> Reading only: no test, the certificate is issued when the reading is finished</label>
        <div className="tp-form-grid tp-form-grid--equal">
          <label className="tp-form-field"><div className="tp-label form-label">Passing score (%)</div><input className="tp-input" type="number" min="0" max="100" value={course.pass_threshold} disabled={course.view_only} onChange={(event) => update("pass_threshold", event.target.value)} required /></label>
          <label className="tp-form-field"><div className="tp-label form-label">Minimum reading time (seconds)</div><input className="tp-input" type="number" min="0" value={course.read_seconds} onChange={(event) => update("read_seconds", event.target.value)} required /></label>
        </div>
        <label className="check-row check-row--last"><input type="checkbox" checked={course.is_active} onChange={(event) => update("is_active", event.target.checked)} /> Make this course available to learners</label>
        <div className="tp-form-actions"><button className="tp-btn tp-btn-primary" type="submit" disabled={saving}>{saving ? "Creating…" : course.view_only ? "Create course" : suggest ? "Create course and generate questions" : "Create course and add questions"}</button></div>
        <Notice tone="error" className="form-notice">{error}</Notice>
      </form>
    </main>
  );
}
