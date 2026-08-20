"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function emptyDraft(courseId) {
  return { course_id: courseId, question_type: "main_test", page_number: null, question_text: "", options: ["", "", "", ""], correct_index: 0, explanation: "" };
}

function QuestionEditor({ draft, setDraft, editing, saving, formError, onSave, onCancel }) {
  return (
    <div className={`tp-card question-editor tp-fade-in ${editing ? "is-inline" : ""}`}>
      <div className="tp-label" style={{ marginBottom: 14 }}>{editing ? "Edit question" : "New question"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <div className="tp-label" style={{ marginBottom: 6 }}>Question bank</div>
          <select className="tp-input" value={draft.question_type} onChange={(e) => setDraft({ ...draft, question_type: e.target.value, page_number: e.target.value === "reading_test" ? draft.page_number : null })}>
            <option value="main_test">Main test</option>
            <option value="reading_test">Reading test</option>
          </select>
        </div>
      </div>
      {draft.question_type === "reading_test" && (
        <div style={{ marginBottom: 12 }}>
          <div className="tp-label" style={{ marginBottom: 6 }}>PDF page number</div>
          <input className="tp-input" type="number" min="1" value={draft.page_number ?? ""} placeholder="e.g. 4" onChange={(e) => setDraft({ ...draft, page_number: e.target.value ? Number(e.target.value) : null })} />
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <div className="tp-label" style={{ marginBottom: 6 }}>Question text</div>
        <textarea className="tp-input" rows={2} value={draft.question_text} onChange={(e) => setDraft({ ...draft, question_text: e.target.value })} />
      </div>
      <div className="tp-label" style={{ marginBottom: 6 }}>Answer options — select the correct one</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {draft.options.map((opt, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" aria-label={`Mark option ${i + 1} correct`} onClick={() => setDraft({ ...draft, correct_index: i })} style={{ width: 18, height: 18, padding: 0, borderRadius: "50%", border: `1.5px solid ${draft.correct_index === i ? "var(--accent)" : "var(--border)"}`, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              {draft.correct_index === i && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />}
            </button>
            <input className="tp-input" value={opt} placeholder={`Option ${i + 1}`} onChange={(e) => { const options = [...draft.options]; options[i] = e.target.value; setDraft({ ...draft, options }); }} />
            <button type="button" className="tp-btn tp-btn-ghost" style={{ padding: "6px 10px" }} disabled={draft.options.length <= 2} aria-label={`Remove option ${i + 1}`} onClick={() => {
              const options = draft.options.filter((_, index) => index !== i);
              const correct_index = draft.correct_index === i ? 0 : draft.correct_index > i ? draft.correct_index - 1 : draft.correct_index;
              setDraft({ ...draft, options, correct_index });
            }}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="tp-btn tp-btn-ghost" style={{ marginBottom: 12 }} onClick={() => setDraft({ ...draft, options: [...draft.options, ""] })}>+ Add option</button>
      <div style={{ marginBottom: 16 }}>
        <div className="tp-label" style={{ marginBottom: 6 }}>Explanation (shown after submit)</div>
        <textarea className="tp-input" rows={2} value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="tp-btn tp-btn-primary" disabled={saving} onClick={onSave}>{saving ? "Saving…" : "Save question"}</button>
        <button className="tp-btn tp-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
      {formError && <div style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 10 }}>{formError}</div>}
    </div>
  );
}

export default function QuestionBankClient({ courses, initialQuestions, initialCourseId }) {
  const supabase = createClient();
  const [courseId, setCourseId] = useState(courses.some((course) => course.id === initialCourseId) ? initialCourseId : courses[0]?.id);
  const [questions, setQuestions] = useState(initialQuestions);
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const filtered = questions.filter((q) => q.course_id === courseId);

  async function saveDraft() {
    if (!draft.question_text.trim() || draft.options.length < 2 || draft.options.some((o) => !o.trim())) {
      setFormError("Enter the question text and at least two complete answer options.");
      return;
    }
    if (draft.question_type === "reading_test" && !draft.page_number) {
      setFormError("A reading-test question needs a PDF page number.");
      return;
    }
    setFormError("");
    setSaving(true);
    let saved = false;
    if (editingId) {
      const { data, error } = await supabase.from("questions").update(draft).eq("id", editingId).select().single();
      if (error) setFormError(error.message);
      else {
        setQuestions((prev) => prev.map((q) => (q.id === editingId ? data : q)));
        saved = true;
      }
    } else {
      const { data, error } = await supabase.from("questions").insert(draft).select().single();
      if (error) setFormError(error.message);
      else {
        setQuestions((prev) => [...prev, data]);
        saved = true;
      }
    }
    setSaving(false);
    if (saved) {
      setDraft(null);
      setEditingId(null);
    }
  }

  async function deleteQuestion(id) {
    await supabase.from("questions").delete().eq("id", id);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  return (
    <main className="bank-page tp-fade-in">
      <div className="bank-heading">
        <div><div className="tp-label">Admin workspace</div><h1 className="tp-display">Question bank</h1></div>
        <button className="tp-btn tp-btn-primary" onClick={() => { setDraft(emptyDraft(courseId)); setEditingId(null); setFormError(""); }}>+ Add question</button>
      </div>

      <div className="course-filter">
        {courses.map((c) => (
          <button
            key={c.id}
            style={{ color: courseId === c.id ? "#FFFFFF" : "var(--faint)" }}
            className={`tp-btn ${courseId === c.id ? "is-selected" : ""}`}
            onClick={() => { setCourseId(c.id); setDraft(null); setEditingId(null); setFormError(""); }}
          >
            {c.code} <span style={{ opacity: 0.6 }}>({questions.filter((q) => q.course_id === c.id && q.question_type === "main_test").length} main · {questions.filter((q) => q.course_id === c.id && q.question_type === "reading_test").length} reading)</span>
          </button>
        ))}
      </div>

      {filtered.filter((q) => q.question_type === "main_test").length < 5 && (
        <div className="notice">
          This course needs at least 5 main-test questions before a complete assessment can be generated. Currently {filtered.filter((q) => q.question_type === "main_test").length}.
        </div>
      )}

      {draft && !editingId && <QuestionEditor draft={draft} setDraft={setDraft} editing={false} saving={saving} formError={formError} onSave={saveDraft} onCancel={() => { setDraft(null); setEditingId(null); }} />}

      <div className="question-list">
        {filtered.map((q) => editingId === q.id && draft ? (
          <QuestionEditor key={q.id} draft={draft} setDraft={setDraft} editing saving={saving} formError={formError} onSave={saveDraft} onCancel={() => { setDraft(null); setEditingId(null); }} />
        ) : (
          <div key={q.id} className="tp-card question-item">
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span className="tp-badge" style={{ background: q.question_type === "reading_test" ? "var(--warn-dim)" : "var(--accent-dim)", color: q.question_type === "reading_test" ? "var(--warn)" : "var(--accent)" }}>{q.question_type === "reading_test" ? `Reading · p. ${q.page_number}` : "Main test"}</span>
                <span className="tp-badge" style={{ background: "var(--surface3)", color: "var(--dim)" }}>{q.options?.length || 0} options</span>
              </div>
              <div style={{ fontSize: 13.5 }}>{q.question_text}</div>
            </div>
            <div className="question-item__actions" style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                className="tp-btn tp-btn-ghost"
                style={{ padding: "6px 12px" }}
                onClick={() => { setDraft({ course_id: q.course_id, question_type: q.question_type || "main_test", page_number: q.page_number, question_text: q.question_text, options: [...q.options], correct_index: q.correct_index, explanation: q.explanation }); setEditingId(q.id); setFormError(""); }}
              >
                Edit
              </button>
              <button className="tp-btn tp-btn-danger" style={{ padding: "6px 12px" }} onClick={() => deleteQuestion(q.id)}>Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="tp-card" style={{ padding: 20, color: "var(--faint)", fontSize: 13 }}>No questions yet for this course.</div>}
      </div>
    </main>
  );
}
