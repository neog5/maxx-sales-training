"use client";

import { useEffect, useMemo } from "react";
import Notice from "@/components/Notice";
import { QUESTION_IMAGE_ACCEPT, QUESTION_IMAGE_HINT, questionImageError } from "@/lib/question-images";

export function emptyDraft(courseId) {
  return { course_id: courseId, question_type: "main_test", material_id: null, page_number: null, question_text: "", image_url: null, is_mandatory: false, options: ["", "", "", ""], correct_index: 0, explanation: "" };
}

// The editable fields of a saved question.
export function draftFromQuestion(question) {
  return {
    course_id: question.course_id,
    question_type: question.question_type || "main_test",
    material_id: question.material_id || null,
    page_number: question.page_number,
    question_text: question.question_text,
    image_url: question.image_url || null,
    is_mandatory: Boolean(question.is_mandatory),
    options: [...question.options],
    correct_index: question.correct_index,
    explanation: question.explanation,
  };
}

// Why a draft can't be saved yet, or "" when it can.
export function draftError(draft, imageFile) {
  if (!draft.question_text.trim() || draft.options.length < 2 || draft.options.some((option) => !option.trim())) {
    return "Enter the question text and at least two complete answer options.";
  }
  if (draft.question_type === "reading_test" && !draft.page_number) return "A reading-test question needs a PDF page number.";
  if (draft.question_type === "reading_test" && !draft.material_id) return "Add a reading deck to this course before adding reading-test questions.";
  return questionImageError(imageFile);
}

// The row to write: only main-test questions can be mandatory.
export function questionPayload(draft) {
  return { ...draft, is_mandatory: draft.question_type === "main_test" && draft.is_mandatory };
}

function withQuestionType(draft, questionType, materials) {
  const reading = questionType === "reading_test";
  return {
    ...draft,
    question_type: questionType,
    material_id: reading ? draft.material_id || materials[0]?.id || null : null,
    page_number: reading ? draft.page_number : null,
    is_mandatory: questionType === "main_test" ? draft.is_mandatory : false,
  };
}

function withoutOption(draft, index) {
  const options = draft.options.filter((_, optionIndex) => optionIndex !== index);
  const correctIndex = draft.correct_index === index ? 0 : draft.correct_index > index ? draft.correct_index - 1 : draft.correct_index;
  return { ...draft, options, correct_index: correctIndex };
}

function Field({ label, className = "", children }) {
  return (
    <div className={className}>
      <div className="tp-label form-label">{label}</div>
      {children}
    </div>
  );
}

export default function QuestionEditor({ materials, draft, setDraft, imageFile, setImageFile, editing, saving, error, onSave, onCancel }) {
  const imagePreview = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : draft.image_url, [imageFile, draft.image_url]);
  const multipleDecks = materials.length > 1;

  useEffect(() => {
    if (!imageFile || !imagePreview) return;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imageFile, imagePreview]);

  const set = (changes) => setDraft({ ...draft, ...changes });

  function setOption(index, value) {
    const options = [...draft.options];
    options[index] = value;
    set({ options });
  }

  function removeImage() {
    setImageFile(null);
    set({ image_url: null });
  }

  return (
    <div className={`tp-card question-editor tp-fade-in ${editing ? "is-inline" : ""}`}>
      <div className="tp-label form-section-label">{editing ? "Edit question" : "New question"}</div>
      <div className="question-editor__row">
        <Field label="Question bank">
          <select className="tp-input" value={draft.question_type} onChange={(event) => setDraft(withQuestionType(draft, event.target.value, materials))}>
            <option value="main_test">Main test</option>
            <option value="reading_test">Reading test</option>
          </select>
        </Field>
      </div>
      {draft.question_type === "reading_test" && (
        <div className={`question-editor__row ${multipleDecks ? "question-editor__row--deck" : "question-editor__row--single"}`}>
          {multipleDecks && (
            <Field label="Deck">
              <select className="tp-input" value={draft.material_id || ""} onChange={(event) => set({ material_id: event.target.value })}>
                {materials.map((material, index) => <option key={material.id} value={material.id}>{index + 1}. {material.title}</option>)}
              </select>
            </Field>
          )}
          <Field label={multipleDecks ? "Page in that deck" : "PDF page number"}>
            <input className="tp-input" type="number" min="1" value={draft.page_number ?? ""} placeholder="e.g. 4" onChange={(event) => set({ page_number: event.target.value ? Number(event.target.value) : null })} />
          </Field>
        </div>
      )}
      <Field label="Question text" className="question-editor__field">
        <textarea className="tp-input" rows={2} value={draft.question_text} onChange={(event) => set({ question_text: event.target.value })} />
      </Field>
      <Field label="Question image (optional)" className="question-editor__field">
        {imagePreview && <img className="question-media question-media--editor" src={imagePreview} alt="Question media preview" />}
        <input className="tp-input" type="file" accept={QUESTION_IMAGE_ACCEPT} onChange={(event) => setImageFile(event.target.files?.[0] || null)} />
        <div className="question-editor__image-hint">
          <span>{QUESTION_IMAGE_HINT}</span>
          {(imageFile || draft.image_url) && <button type="button" className="question-media-remove" onClick={removeImage}>Remove image</button>}
        </div>
      </Field>
      {draft.question_type === "main_test" && (
        <label className="question-mandatory-toggle">
          <input type="checkbox" checked={draft.is_mandatory} onChange={(event) => set({ is_mandatory: event.target.checked })} />
          <span><b>Mandatory assessment question</b><small>Always include this question in every main assessment.</small></span>
        </label>
      )}
      <div className="tp-label form-label">Answer options — select the correct one</div>
      <div className="question-editor__options">
        {draft.options.map((option, index) => (
          <div key={index} className="question-editor__option">
            <button type="button" className={`correct-toggle ${draft.correct_index === index ? "is-correct" : ""}`} aria-label={`Mark option ${index + 1} correct`} aria-pressed={draft.correct_index === index} onClick={() => set({ correct_index: index })} />
            <input className="tp-input" value={option} placeholder={`Option ${index + 1}`} onChange={(event) => setOption(index, event.target.value)} />
            <button type="button" className="tp-btn tp-btn-ghost tp-btn--compact" disabled={draft.options.length <= 2} aria-label={`Remove option ${index + 1}`} onClick={() => setDraft(withoutOption(draft, index))}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="tp-btn tp-btn-ghost question-editor__add-option" onClick={() => set({ options: [...draft.options, ""] })}>+ Add option</button>
      <Field label="Explanation (shown after submit)" className="question-editor__field--last">
        <textarea className="tp-input" rows={2} value={draft.explanation} onChange={(event) => set({ explanation: event.target.value })} />
      </Field>
      <div className="question-editor__actions">
        <button type="button" className="tp-btn tp-btn-primary" disabled={saving} onClick={onSave}>{saving ? "Saving…" : "Save question"}</button>
        <button type="button" className="tp-btn tp-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
      <Notice tone="error" className="form-notice">{error}</Notice>
    </div>
  );
}
