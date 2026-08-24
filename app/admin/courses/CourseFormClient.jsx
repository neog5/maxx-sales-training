"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const initialCourse = { code: "", title: "", description: "", pass_threshold: 80, read_seconds: 60, is_active: true };
const initialRecommendationCounts = { reading: 5, main: 10 };

function safeFileName(name) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function CourseFormClient() {
  const router = useRouter();
  const supabase = createClient();
  const [course, setCourse] = useState(initialCourse);
  const [pdf, setPdf] = useState(null);
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
    if (pdf && pdf.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      return;
    }

    setError("");
    setSaving(true);
    let uploadedPath;
    try {
      let pdfUrl = null;
      if (pdf) {
        uploadedPath = `${code.toLowerCase()}/${crypto.randomUUID()}-${safeFileName(pdf.name) || "course.pdf"}`;
        const { error: uploadError } = await supabase.storage.from("course-pdfs").upload(uploadedPath, pdf, { contentType: "application/pdf" });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("course-pdfs").getPublicUrl(uploadedPath);
        pdfUrl = data.publicUrl;
      }

      const { data: created, error: insertError } = await supabase.from("courses").insert({
        ...course,
        code,
        title: course.title.trim(),
        description: course.description.trim() || null,
        pass_threshold: Number(course.pass_threshold),
        read_seconds: Number(course.read_seconds),
        pdf_url: pdfUrl,
      }).select("id").single();
      if (insertError) throw insertError;
      const suggestionQuery = pdf
        ? `&suggest=1&reading=${recommendationCounts.reading}&main=${recommendationCounts.main}`
        : "";
      router.push(`/admin/questions?course=${created.id}${suggestionQuery}`);
      router.refresh();
    } catch (cause) {
      if (uploadedPath) await supabase.storage.from("course-pdfs").remove([uploadedPath]);
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
        <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Description</div><textarea className="tp-input" rows={3} value={course.description} placeholder="What reps will learn in this course." onChange={(e) => update("description", e.target.value)} /></label>
        <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Training PDF</div><input className="tp-input" type="file" accept="application/pdf,.pdf" onChange={(e) => setPdf(e.target.files?.[0] || null)} /><div style={{ color: "var(--faint)", fontSize: 11.5, marginTop: 6 }}>Optional · PDFs are stored in the <span className="tp-mono">course-pdfs</span> bucket (50 MB maximum).</div></label>
        {pdf && <div className="tp-form-grid tp-form-grid--equal">
          <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Reading recommendations</div><input className="tp-input" type="number" min="1" max="10" value={recommendationCounts.reading} onChange={(e) => setRecommendationCounts((current) => ({ ...current, reading: e.target.value }))} required /></label>
          <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Main-test recommendations</div><input className="tp-input" type="number" min="5" max="30" value={recommendationCounts.main} onChange={(e) => setRecommendationCounts((current) => ({ ...current, main: e.target.value }))} required /></label>
        </div>}
        <div className="tp-form-grid tp-form-grid--equal">
          <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Passing score (%)</div><input className="tp-input" type="number" min="0" max="100" value={course.pass_threshold} onChange={(e) => update("pass_threshold", e.target.value)} required /></label>
          <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Minimum reading time (seconds)</div><input className="tp-input" type="number" min="0" value={course.read_seconds} onChange={(e) => update("read_seconds", e.target.value)} required /></label>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 18 }}><input type="checkbox" checked={course.is_active} onChange={(e) => update("is_active", e.target.checked)} /> Make this course available to reps</label>
        <div className="tp-form-actions"><button className="tp-btn tp-btn-primary" type="submit" disabled={saving}>{saving ? "Creating…" : pdf ? "Create course and generate questions" : "Create course and add questions"}</button></div>
        {error && <div style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 10 }}>{error}</div>}
      </form>
    </main>
  );
}
