"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function emptyDraft(courseId) {
  return { course_id: courseId, question_type: "main_test", page_number: null, question_text: "", image_url: null, is_mandatory: false, options: ["", "", "", ""], correct_index: 0, explanation: "" };
}

function generationCount(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function QuestionEditor({ draft, setDraft, imageFile, setImageFile, editing, saving, formError, onSave, onCancel }) {
  const imagePreview = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : draft.image_url, [imageFile, draft.image_url]);

  useEffect(() => {
    if (!imageFile || !imagePreview) return;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imageFile, imagePreview]);

  return (
    <div className={`tp-card question-editor tp-fade-in ${editing ? "is-inline" : ""}`}>
      <div className="tp-label" style={{ marginBottom: 14 }}>{editing ? "Edit question" : "New question"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <div className="tp-label" style={{ marginBottom: 6 }}>Question bank</div>
          <select className="tp-input" value={draft.question_type} onChange={(e) => setDraft({ ...draft, question_type: e.target.value, page_number: e.target.value === "reading_test" ? draft.page_number : null, is_mandatory: e.target.value === "main_test" ? draft.is_mandatory : false })}>
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
      <div style={{ marginBottom: 12 }}>
        <div className="tp-label" style={{ marginBottom: 6 }}>Question image (optional)</div>
        {imagePreview && <img className="question-media question-media--editor" src={imagePreview} alt="Question media preview" />}
        <input className="tp-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setImageFile(event.target.files?.[0] || null)} />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6, color: "var(--faint)", fontSize: 11.5 }}>
          <span>JPEG, PNG, WebP, or GIF · 5 MB maximum</span>
          {(imageFile || draft.image_url) && <button type="button" className="question-media-remove" onClick={() => { setImageFile(null); setDraft({ ...draft, image_url: null }); }}>Remove image</button>}
        </div>
      </div>
      {draft.question_type === "main_test" && (
        <label className="question-mandatory-toggle">
          <input type="checkbox" checked={draft.is_mandatory} onChange={(event) => setDraft({ ...draft, is_mandatory: event.target.checked })} />
          <span><b>Mandatory assessment question</b><small>Always include this question in every main assessment.</small></span>
        </label>
      )}
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

function SuggestionPanel({ questions, selected, loading, importing, error, counts, onToggle, onSelectAll, onClear, onGenerate, onImport }) {
  if (loading) {
    return (
      <section className="tp-card suggestion-panel suggestion-panel--loading" aria-live="polite">
        <div className="suggestion-spinner" />
        <div><strong>Generating suggestions…</strong><span>Preparing {counts.reading} reading question{counts.reading === 1 ? "" : "s"} and {counts.main} main question{counts.main === 1 ? "" : "s"}. This may take a few minutes.</span></div>
      </section>
    );
  }

  if (!questions?.length) {
    return error ? (
      <section className="tp-card suggestion-panel">
        <div className="suggestion-panel__header"><div><div className="tp-label">Question suggestions</div><h2>Suggestions need another try</h2><p>{error}</p></div><button className="tp-btn tp-btn-primary" onClick={onGenerate}>Try again</button></div>
      </section>
    ) : null;
  }

  return (
    <section className="tp-card suggestion-panel" aria-label="Question suggestions">
      <div className="suggestion-panel__header">
        <div><div className="tp-label">Question suggestions</div><h2>Review suggested questions</h2><p>Select the accurate, relevant questions to add. Nothing is saved until you confirm.</p></div>
        <button className="tp-btn tp-btn-ghost" onClick={onGenerate} disabled={importing}>Regenerate</button>
      </div>
      <div className="suggestion-toolbar">
        <strong>{selected.size} of {questions.length} selected</strong>
        <div><button type="button" onClick={onSelectAll}>Select all</button><button type="button" onClick={onClear}>Clear</button></div>
      </div>
      <div className="suggestion-list">
        {questions.map((question, index) => {
          const isSelected = selected.has(index);
          const isTrueFalse = question.options.length === 2 && question.options[0] === "True" && question.options[1] === "False";
          return (
            <label key={`${question.question_type}-${index}`} className={`suggestion-item ${isSelected ? "is-selected" : ""}`}>
              <input type="checkbox" checked={isSelected} onChange={() => onToggle(index)} />
              <div className="suggestion-item__body">
                <div className="suggestion-item__meta">
                  <span className="tp-badge">{question.question_type === "reading_test" ? `Reading · p. ${question.page_number}` : "Main test"}</span>
                  {isTrueFalse && <span className="tp-badge">True / False</span>}
                </div>
                <strong>{question.question_text}</strong>
                <div className="suggestion-options">
                  {question.options.map((option, optionIndex) => <span key={optionIndex} className={optionIndex === question.correct_index ? "is-answer" : ""}>{option}{optionIndex === question.correct_index ? " ✓" : ""}</span>)}
                </div>
                <p><b>Why:</b> {question.explanation}</p>
              </div>
            </label>
          );
        })}
      </div>
      {error && <div className="suggestion-error">{error}</div>}
      <div className="suggestion-panel__footer">
        <span>Unselected questions will be discarded.</span>
        <button className="tp-btn tp-btn-primary" onClick={onImport} disabled={importing || selected.size === 0}>{importing ? "Adding questions…" : `Add ${selected.size} selected question${selected.size === 1 ? "" : "s"}`}</button>
      </div>
    </section>
  );
}

export default function QuestionBankClient({ courses, initialQuestions, initialCourseId, autoSuggest = false, initialGenerationCounts = {} }) {
  const supabase = createClient();
  const [courseId, setCourseId] = useState(courses.some((course) => course.id === initialCourseId) ? initialCourseId : courses[0]?.id);
  const [questions, setQuestions] = useState(initialQuestions);
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [formError, setFormError] = useState("");
  const [suggestions, setSuggestions] = useState(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [generationCounts, setGenerationCounts] = useState({
    reading: generationCount(initialGenerationCounts.reading, 1, 10, 5),
    main: generationCount(initialGenerationCounts.main, 5, 30, 10),
  });
  const autoSuggestStarted = useRef(false);
  const generationRequest = useRef(null);

  const filtered = questions.filter((q) => q.course_id === courseId);
  const mainQuestions = filtered.filter((question) => question.question_type === "main_test");
  const mandatoryCount = mainQuestions.filter((question) => question.is_mandatory).length;
  const targetAssessmentCount = Math.max(5, Math.round(mandatoryCount / 0.6));
  const optionalCount = mainQuestions.length - mandatoryCount;
  const requiredOptionalCount = Math.max(0, targetAssessmentCount - mandatoryCount);

  async function generateSuggestions() {
    if (!courseId) return;
    generationRequest.current?.abort();
    const controller = new AbortController();
    generationRequest.current = controller;
    setGenerating(true);
    setSuggestionError("");
    setSuggestions(null);
    setSelectedSuggestions(new Set());
    try {
      const response = await fetch("/api/admin/question-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, readingCount: Number(generationCounts.reading), mainCount: Number(generationCounts.main) }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not generate question suggestions.");
      setSuggestions(payload.questions);
      setSelectedSuggestions(new Set(payload.questions.map((_, index) => index)));
    } catch (error) {
      if (error.name === "AbortError") return;
      setSuggestionError(error.message || "Could not generate question suggestions.");
    } finally {
      if (generationRequest.current === controller) {
        generationRequest.current = null;
        setGenerating(false);
      }
    }
  }

  function selectCourse(nextCourseId) {
    generationRequest.current?.abort();
    generationRequest.current = null;
    setGenerating(false);
    setCourseId(nextCourseId);
    setDraft(null);
    setImageFile(null);
    setEditingId(null);
    setFormError("");
    setMutationError("");
    setSuggestions(null);
    setSelectedSuggestions(new Set());
    setSuggestionError("");
  }

  useEffect(() => {
    if (!autoSuggestStarted.current && autoSuggest && courseId) {
      autoSuggestStarted.current = true;
      generateSuggestions();
    }
  }, [autoSuggest, courseId]);

  useEffect(() => () => generationRequest.current?.abort(), []);

  async function importSuggestions() {
    const chosen = suggestions
      .filter((_, index) => selectedSuggestions.has(index))
      .map((question) => ({ ...question, course_id: courseId }));
    if (!chosen.length) return;

    setImporting(true);
    setSuggestionError("");
    const { data, error } = await supabase.from("questions").insert(chosen).select();
    if (error) {
      console.error("Could not add selected question suggestions", error);
      setSuggestionError("We couldn’t add the selected questions. Please try again.");
    } else {
      setQuestions((current) => [...current, ...(data || [])]);
      setSuggestions(null);
      setSelectedSuggestions(new Set());
    }
    setImporting(false);
  }

  async function saveDraft() {
    if (!draft.question_text.trim() || draft.options.length < 2 || draft.options.some((o) => !o.trim())) {
      setFormError("Enter the question text and at least two complete answer options.");
      return;
    }
    if (draft.question_type === "reading_test" && !draft.page_number) {
      setFormError("A reading-test question needs a PDF page number.");
      return;
    }
    if (imageFile && (imageFile.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(imageFile.type))) {
      setFormError("Choose a JPEG, PNG, WebP, or GIF image no larger than 5 MB.");
      return;
    }
    setFormError("");
    setMutationError("");
    setSaving(true);
    let uploadedPath = null;
    let payload = { ...draft, is_mandatory: draft.question_type === "main_test" && draft.is_mandatory };
    if (imageFile) {
      const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
      uploadedPath = `${courseId}/${crypto.randomUUID()}.${extensions[imageFile.type]}`;
      const { error: uploadError } = await supabase.storage.from("question-images").upload(uploadedPath, imageFile, { contentType: imageFile.type });
      if (uploadError) {
        setFormError(`Could not upload the question image: ${uploadError.message}`);
        setSaving(false);
        return;
      }
      payload.image_url = supabase.storage.from("question-images").getPublicUrl(uploadedPath).data.publicUrl;
    }
    let saved = false;
    if (editingId) {
      const { data, error } = await supabase.from("questions").update(payload).eq("id", editingId).select().single();
      if (error) setFormError(error.message);
      else {
        setQuestions((prev) => prev.map((q) => (q.id === editingId ? data : q)));
        saved = true;
      }
    } else {
      const { data, error } = await supabase.from("questions").insert(payload).select().single();
      if (error) setFormError(error.message);
      else {
        setQuestions((prev) => [...prev, data]);
        saved = true;
      }
    }
    setSaving(false);
    if (!saved && uploadedPath) await supabase.storage.from("question-images").remove([uploadedPath]);
    if (saved) {
      setDraft(null);
      setImageFile(null);
      setEditingId(null);
    }
  }

  async function deleteQuestion(id) {
    setMutationError("");
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      setMutationError("We couldn’t delete that question. Please try again.");
      return;
    }
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  return (
    <main className="bank-page tp-fade-in">
      <div className="bank-heading">
        <div><div className="tp-label">Admin workspace</div><h1 className="tp-display">Question bank</h1></div>
        <button className="tp-btn tp-btn-primary" onClick={() => { setDraft(emptyDraft(courseId)); setImageFile(null); setEditingId(null); setFormError(""); }}>+ Add question</button>
      </div>

      <div className="course-filter">
        {courses.map((c) => (
          <button
            key={c.id}
            className={`tp-btn ${courseId === c.id ? "is-selected" : ""}`}
            onClick={() => selectCourse(c.id)}
          >
            {c.code} <span style={{ opacity: 0.6 }}>({questions.filter((q) => q.course_id === c.id && q.question_type === "main_test").length} main · {questions.filter((q) => q.course_id === c.id && q.question_type === "reading_test").length} reading)</span>
          </button>
        ))}
      </div>

      {mutationError && <div className="notice" role="alert">{mutationError}</div>}

      {!suggestions && !generating && !suggestionError && courses.find((course) => course.id === courseId)?.pdf_url && (
        <div className="suggestion-launch">
          <span>Generate from this course’s PDF</span>
          <label><b>Reading</b><input className="tp-input" type="number" min="1" max="10" value={generationCounts.reading} onChange={(event) => setGenerationCounts((current) => ({ ...current, reading: event.target.value }))} /></label>
          <label><b>Main test</b><input className="tp-input" type="number" min="5" max="30" value={generationCounts.main} onChange={(event) => setGenerationCounts((current) => ({ ...current, main: event.target.value }))} /></label>
          <button className="tp-btn tp-btn-ghost" onClick={generateSuggestions}>Generate recommendations</button>
        </div>
      )}

      <SuggestionPanel
        questions={suggestions}
        selected={selectedSuggestions}
        loading={generating}
        importing={importing}
        error={suggestionError}
        counts={{ reading: Number(generationCounts.reading), main: Number(generationCounts.main) }}
        onToggle={(index) => setSelectedSuggestions((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; })}
        onSelectAll={() => setSelectedSuggestions(new Set(suggestions.map((_, index) => index)))}
        onClear={() => setSelectedSuggestions(new Set())}
        onGenerate={generateSuggestions}
        onImport={importSuggestions}
      />

      {(mainQuestions.length < targetAssessmentCount || optionalCount < requiredOptionalCount) && (
        <div className="notice">
          This course needs {targetAssessmentCount} main-test questions ({mandatoryCount} mandatory and at least {requiredOptionalCount} non-mandatory) for the 60/40 assessment mix. Currently it has {mainQuestions.length} total and {optionalCount} non-mandatory.
        </div>
      )}

      {draft && !editingId && <QuestionEditor draft={draft} setDraft={setDraft} imageFile={imageFile} setImageFile={setImageFile} editing={false} saving={saving} formError={formError} onSave={saveDraft} onCancel={() => { setDraft(null); setImageFile(null); setEditingId(null); }} />}

      <div className="question-list">
        {filtered.map((q) => editingId === q.id && draft ? (
          <QuestionEditor key={q.id} draft={draft} setDraft={setDraft} imageFile={imageFile} setImageFile={setImageFile} editing saving={saving} formError={formError} onSave={saveDraft} onCancel={() => { setDraft(null); setImageFile(null); setEditingId(null); }} />
        ) : (
          <div key={q.id} className="tp-card question-item">
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span className="tp-badge" style={{ background: q.question_type === "reading_test" ? "var(--warn-dim)" : "var(--accent-dim)", color: q.question_type === "reading_test" ? "var(--warn)" : "var(--accent)" }}>{q.question_type === "reading_test" ? `Reading · p. ${q.page_number}` : "Main test"}</span>
                <span className="tp-badge" style={{ background: "var(--surface3)", color: "var(--dim)" }}>{q.options?.length || 0} options</span>
                {q.is_mandatory && <span className="tp-badge question-mandatory-badge">Mandatory</span>}
                {q.image_url && <span className="tp-badge">Image</span>}
              </div>
              <div style={{ fontSize: 13.5 }}>{q.question_text}</div>
              {q.image_url && <img className="question-media question-media--bank" src={q.image_url} alt="" />}
            </div>
            <div className="question-item__actions" style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                className="tp-btn tp-btn-ghost"
                style={{ padding: "6px 12px" }}
                onClick={() => { setDraft({ course_id: q.course_id, question_type: q.question_type || "main_test", page_number: q.page_number, question_text: q.question_text, image_url: q.image_url || null, is_mandatory: Boolean(q.is_mandatory), options: [...q.options], correct_index: q.correct_index, explanation: q.explanation }); setImageFile(null); setEditingId(q.id); setFormError(""); }}
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
