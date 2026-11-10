"use client";

import { GENERATION_LIMITS } from "@/lib/question-suggestions";

// Picks the deck and how many questions to generate, then starts generation.
export default function SuggestionLauncher({ materials, deckId, onDeckChange, counts, onCountChange, onGenerate }) {
  const total = Number(counts.reading) + Number(counts.main);
  return (
    <div className="suggestion-launch">
      {materials.length > 1 ? (
        <label>
          <b>Generate from deck</b>
          <select className="tp-input" value={deckId} onChange={(event) => onDeckChange(event.target.value)}>
            {materials.map((material, index) => <option key={material.id} value={material.id}>{index + 1}. {material.title}</option>)}
          </select>
        </label>
      ) : <span>Generate from this course’s PDF</span>}
      <label><b>Reading</b><input className="tp-input" type="number" min="0" max={GENERATION_LIMITS.reading.max} value={counts.reading} onChange={(event) => onCountChange("reading", event.target.value)} /></label>
      <label><b>Main test</b><input className="tp-input" type="number" min="0" max={GENERATION_LIMITS.main.max} value={counts.main} onChange={(event) => onCountChange("main", event.target.value)} /></label>
      <button type="button" className="tp-btn tp-btn-ghost" onClick={onGenerate} disabled={!(total > 0)}>Generate recommendations</button>
    </div>
  );
}
