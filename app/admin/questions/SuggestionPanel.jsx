"use client";

import { isTrueFalse } from "@/lib/question-suggestions";
import { readingLabel } from "./reading-label";

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// Generated questions waiting for review, or the progress/error state while generating.
// Reading suggestions belong to the deck they were generated from (`deckId`).
export default function SuggestionPanel({ materials, deckId, questions, selected, loading, importing, error, counts, onToggle, onSelectAll, onClear, onGenerate, onImport }) {
  if (loading) {
    return (
      <section className="tp-card suggestion-panel suggestion-panel--loading" aria-live="polite">
        <div className="suggestion-spinner" />
        <div><strong>Generating suggestions…</strong><span>Preparing {plural(counts.reading, "reading question")} and {plural(counts.main, "main question")}. This may take a few minutes.</span></div>
      </section>
    );
  }

  if (!questions?.length) {
    return error ? (
      <section className="tp-card suggestion-panel">
        <div className="suggestion-panel__header">
          <div><div className="tp-label">Question suggestions</div><h2>Suggestions need another try</h2><p>{error}</p></div>
          <button type="button" className="tp-btn tp-btn-primary" onClick={onGenerate}>Try again</button>
        </div>
      </section>
    ) : null;
  }

  return (
    <section className="tp-card suggestion-panel" aria-label="Question suggestions">
      <div className="suggestion-panel__header">
        <div><div className="tp-label">Question suggestions</div><h2>Review suggested questions</h2><p>Select the accurate, relevant questions to add. Nothing is saved until you confirm.</p></div>
        <button type="button" className="tp-btn tp-btn-ghost" onClick={onGenerate} disabled={importing}>Regenerate</button>
      </div>
      <div className="suggestion-toolbar">
        <strong>{selected.size} of {questions.length} selected</strong>
        <div><button type="button" onClick={onSelectAll}>Select all</button><button type="button" onClick={onClear}>Clear</button></div>
      </div>
      <div className="suggestion-list">
        {questions.map((question, index) => {
          const isSelected = selected.has(index);
          return (
            <label key={`${question.question_type}-${index}`} className={`suggestion-item ${isSelected ? "is-selected" : ""}`}>
              <input type="checkbox" checked={isSelected} onChange={() => onToggle(index)} />
              <div className="suggestion-item__body">
                <div className="suggestion-item__meta">
                  <span className="tp-badge">{question.question_type === "reading_test" ? readingLabel({ ...question, material_id: deckId }, materials) : "Main test"}</span>
                  {isTrueFalse(question) && <span className="tp-badge">True / False</span>}
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
      {error && <div className="suggestion-error" role="alert">{error}</div>}
      <div className="suggestion-panel__footer">
        <span>Unselected questions will be discarded.</span>
        <button type="button" className="tp-btn tp-btn-primary" onClick={onImport} disabled={importing || selected.size === 0}>{importing ? "Adding questions…" : `Add ${plural(selected.size, "selected question")}`}</button>
      </div>
    </section>
  );
}
