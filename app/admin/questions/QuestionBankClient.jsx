"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Notice from "@/components/Notice";
import StatusBadge from "@/components/StatusBadge";
import useMutation from "@/hooks/useMutation";
import { assessmentMix } from "@/lib/assessment";
import { removeUnusedQuestionImage, uploadQuestionImage, QUESTION_IMAGE_BUCKET } from "@/lib/question-images";
import { createClient } from "@/lib/supabase/client";
import QuestionEditor, { draftError, draftFromQuestion, emptyDraft, questionPayload } from "./QuestionEditor";
import SuggestionLauncher from "./SuggestionLauncher";
import SuggestionPanel from "./SuggestionPanel";
import { readingLabel } from "./reading-label";
import { removeStoredFiles } from "@/lib/storage";

const IMPORT_FAILED = { fallback: "We couldn’t add the selected questions. Please try again." };
const DELETE_FAILED = { fallback: "We couldn’t delete that question. Please try again." };

// Asks the server for suggested questions from one deck.
async function requestSuggestions({ courseId, materialId, counts, signal }) {
  const response = await fetch("/api/admin/question-suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseId, materialId, readingCount: Number(counts.reading), mainCount: Number(counts.main) }),
    signal,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not generate question suggestions.");
  return payload.questions;
}

function QuestionItem({ question, materials, readOnly, deleting, onEdit, onDelete }) {
  const reading = question.question_type === "reading_test";
  return (
    <div className="tp-card question-item">
      <div className="question-item__body">
        <div className="question-item__badges">
          <StatusBadge tone={reading ? "warn" : "accent"}>{reading ? readingLabel(question, materials) : "Main test"}</StatusBadge>
          <StatusBadge>{question.options?.length || 0} options</StatusBadge>
          {question.is_mandatory && <span className="tp-badge question-mandatory-badge">Mandatory</span>}
          {question.image_url && <span className="tp-badge">Image</span>}
        </div>
        <div className="question-item__text">{question.question_text}</div>
        {question.image_url && <img className="question-media question-media--bank" src={question.image_url} alt="" />}
      </div>
      {!readOnly && (
        <div className="question-item__actions">
          <button type="button" className="tp-btn tp-btn-ghost tp-btn--small" onClick={onEdit}>Edit</button>
          <button type="button" className="tp-btn tp-btn-danger tp-btn--small" disabled={deleting} onClick={onDelete}>{deleting ? "Deleting…" : "Delete"}</button>
        </div>
      )}
    </div>
  );
}

// One course's questions, shown on the course's Questions tab. Archived courses are read-only.
export default function QuestionBankClient({ course, materials = [], initialQuestions, autoSuggest = false, initialGenerationCounts, readOnly = false }) {
  const supabase = createClient();
  const saver = useMutation();
  const importer = useMutation();
  const deleter = useMutation();
  const [questions, setQuestions] = useState(initialQuestions);
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationCounts, setGenerationCounts] = useState(initialGenerationCounts);
  const [generationDeckId, setGenerationDeckId] = useState(materials[0]?.id || null);
  // The deck the current suggestions were generated from; their reading questions belong to it.
  const [suggestionDeckId, setSuggestionDeckId] = useState(null);
  const autoSuggestStarted = useRef(false);
  const generationRequest = useRef(null);

  const mainQuestions = questions.filter((question) => question.question_type === "main_test");
  const mix = assessmentMix(mainQuestions);
  const suggestionError = generationError || importer.error;

  function openEditor(nextDraft, questionId = null) {
    setDraft(nextDraft);
    setImageFile(null);
    setEditingId(questionId);
    saver.setError("");
  }

  function closeEditor() {
    setDraft(null);
    setImageFile(null);
    setEditingId(null);
  }

  async function generateSuggestions() {
    generationRequest.current?.abort();
    const controller = new AbortController();
    generationRequest.current = controller;
    setGenerating(true);
    setGenerationError("");
    importer.setError("");
    setSuggestions(null);
    setSelectedSuggestions(new Set());
    setSuggestionDeckId(generationDeckId);
    try {
      const generated = await requestSuggestions({ courseId: course.id, materialId: generationDeckId, counts: generationCounts, signal: controller.signal });
      setSuggestions(generated);
      setSelectedSuggestions(new Set(generated.map((_, index) => index)));
    } catch (error) {
      if (error.name === "AbortError") return;
      setGenerationError(error.message || "Could not generate question suggestions.");
    } finally {
      if (generationRequest.current === controller) {
        generationRequest.current = null;
        setGenerating(false);
      }
    }
  }

  // Runs once, when the page opens straight from creating the course. Unmounting cancels
  // the request and clears the flag, so React Strict Mode's dev-only remount starts it again.
  const startAutoSuggest = useEffectEvent(() => generateSuggestions());
  useEffect(() => {
    if (autoSuggestStarted.current || !autoSuggest) return;
    autoSuggestStarted.current = true;
    startAutoSuggest();
    return () => {
      autoSuggestStarted.current = false;
    };
  }, [autoSuggest]);

  // Leaving the page cancels any generation still running.
  useEffect(() => () => generationRequest.current?.abort(), []);

  function toggleSuggestion(index) {
    setSelectedSuggestions((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function importSuggestions() {
    const chosen = suggestions
      .filter((_, index) => selectedSuggestions.has(index))
      .map((question) => ({ ...question, course_id: course.id, material_id: question.question_type === "reading_test" ? suggestionDeckId : null }));
    if (!chosen.length) return;
    const added = await importer.run("import", () => supabase.from("questions").insert(chosen).select(), IMPORT_FAILED);
    if (!added) return;
    setQuestions((current) => [...current, ...added]);
    setSuggestions(null);
    setSelectedSuggestions(new Set());
  }

  // Uploads a new image first, then writes the question. A new image is removed again if
  // the write fails; an image the question no longer uses is removed once it succeeds.
  async function saveDraft() {
    const validation = draftError(draft, imageFile);
    if (validation) {
      saver.setError(validation);
      return;
    }
    deleter.setError("");
    const previousImageUrl = editingId ? questions.find((question) => question.id === editingId)?.image_url : null;
    const saved = await saver.run("save", async () => {
      const payload = questionPayload(draft);
      const upload = imageFile ? await uploadQuestionImage(supabase, course.id, imageFile) : null;
      if (upload) payload.image_url = upload.imageUrl;
      const query = editingId ? supabase.from("questions").update(payload).eq("id", editingId) : supabase.from("questions").insert(payload);
      const result = await query.select().single();
      if (result.error && upload) await removeStoredFiles(supabase, QUESTION_IMAGE_BUCKET, [upload.path]);
      return result;
    });
    if (!saved) return;
    setQuestions((current) => editingId ? current.map((question) => (question.id === editingId ? saved : question)) : [...current, saved]);
    closeEditor();
    if (previousImageUrl && previousImageUrl !== saved.image_url) await removeUnusedQuestionImage(supabase, previousImageUrl);
  }

  async function deleteQuestion(question) {
    if (deleter.busy) return;
    if (!window.confirm("Delete this question? Past attempts keep their copy of it.")) return;
    const deleted = await deleter.run(question.id, () => supabase.from("questions").delete().eq("id", question.id), DELETE_FAILED);
    if (!deleted) return;
    setQuestions((current) => current.filter((row) => row.id !== question.id));
    if (question.image_url) await removeUnusedQuestionImage(supabase, question.image_url);
  }

  const editorProps = {
    materials,
    draft,
    setDraft,
    imageFile,
    setImageFile,
    saving: Boolean(saver.busy),
    error: saver.error,
    onSave: saveDraft,
    onCancel: closeEditor,
  };

  return (
    <section className="bank-page is-embedded">
      <div className="bank-heading">
        <div>
          <div className="tp-label">Question bank</div>
          <span className="bank-heading__counts">{mainQuestions.length} main test · {questions.length - mainQuestions.length} reading{mix.mandatoryCount ? ` · ${mix.mandatoryCount} mandatory` : ""}</span>
        </div>
        {!readOnly && <button type="button" className="tp-btn tp-btn-primary" onClick={() => openEditor(emptyDraft(course.id))}>+ Add question</button>}
      </div>

      {readOnly && <Notice>This course is archived, so its questions are read-only. Restore the course to edit them.</Notice>}

      <Notice tone="error">{deleter.error}</Notice>

      {!readOnly && !suggestions && !generating && !suggestionError && generationDeckId && (
        <SuggestionLauncher
          materials={materials}
          deckId={generationDeckId}
          onDeckChange={setGenerationDeckId}
          counts={generationCounts}
          onCountChange={(kind, value) => setGenerationCounts((current) => ({ ...current, [kind]: value }))}
          onGenerate={generateSuggestions}
        />
      )}

      <SuggestionPanel
        materials={materials}
        deckId={suggestionDeckId}
        questions={suggestions}
        selected={selectedSuggestions}
        loading={generating}
        importing={Boolean(importer.busy)}
        error={suggestionError}
        counts={{ reading: Number(generationCounts.reading), main: Number(generationCounts.main) }}
        onToggle={toggleSuggestion}
        onSelectAll={() => setSelectedSuggestions(new Set(suggestions.map((_, index) => index)))}
        onClear={() => setSelectedSuggestions(new Set())}
        onGenerate={generateSuggestions}
        onImport={importSuggestions}
      />

      {!readOnly && mix.isShort && (
        <Notice>
          This course needs {mix.targetCount} main-test questions ({mix.mandatoryCount} mandatory and at least {mix.requiredOptionalCount} non-mandatory) for the 60/40 assessment mix. Currently it has {mix.total} total and {mix.optionalCount} non-mandatory.
        </Notice>
      )}

      {draft && !editingId && <QuestionEditor {...editorProps} editing={false} />}

      <div className="question-list">
        {questions.map((question) => editingId === question.id && draft ? (
          <QuestionEditor key={question.id} {...editorProps} editing />
        ) : (
          <QuestionItem
            key={question.id}
            question={question}
            materials={materials}
            readOnly={readOnly}
            deleting={deleter.busy === question.id}
            onEdit={() => openEditor(draftFromQuestion(question), question.id)}
            onDelete={() => deleteQuestion(question)}
          />
        ))}
        {questions.length === 0 && <div className="tp-card question-list__empty">No questions yet for this course.</div>}
      </div>
    </section>
  );
}
