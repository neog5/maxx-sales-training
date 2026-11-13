"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COURSE_PDF_BUCKET, deckFileError, materialStoragePathFromUrl, reorderedPositions, titleFromFileName, uploadCourseDeck, withSignedDeckUrls } from "@/lib/course-materials";
import { FREE_PDF_PARSER_LIMIT_TEXT } from "@/lib/question-suggestions";
import { createClient } from "@/lib/supabase/client";
import useAdminMutation from "../../useAdminMutation";
import { removeStoredFiles } from "@/lib/storage";

// The course's reading decks: learners read them in this order before the assessment.
// Decks come from the server, so each change re-renders the page from there.
export default function CourseMaterialsClient({ course, materials, readingCounts, readOnly }) {
  const supabase = createClient();
  const router = useRouter();
  const { run, busy, fail, notices } = useAdminMutation();
  const [titles, setTitles] = useState({});

  async function change(label, action, messages, { refreshOnFailure = false } = {}) {
    const data = await run(label, action, messages);
    if (data || refreshOnFailure) router.refresh();
    return data;
  }

  // Uploads each PDF and adds it after the current last deck. Stops at the first failure;
  // decks added before it stay, so the page refreshes either way.
  async function uploadDecks(files) {
    let position = Math.max(0, ...materials.map((material) => material.position));
    for (const file of files) {
      const { path, pdfUrl } = await uploadCourseDeck(supabase, course.code, file);
      position += 1;
      const result = await supabase.from("course_materials").insert({ course_id: course.id, position, title: titleFromFileName(file.name), pdf_url: pdfUrl });
      if (result.error) {
        await removeStoredFiles(supabase, COURSE_PDF_BUCKET, [path]);
        return result;
      }
    }
    return { data: true };
  }

  function addDecks(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const fileError = files.map(deckFileError).find(Boolean);
    if (fileError) {
      fail(fileError);
      return;
    }
    change("upload", () => uploadDecks(files),
      { success: files.length === 1 ? "Deck added. Give it a clear title below." : `${files.length} decks added. Give them clear titles below.` },
      { refreshOnFailure: true });
  }

  // The bucket is private, so each "Open" gets a fresh link that works for an hour.
  // The tab is opened first, while the click still counts, so pop-up blockers allow it.
  async function open(material) {
    const tab = window.open("", "_blank");
    const [deck] = await withSignedDeckUrls(supabase, [material], 60 * 60);
    if (tab) tab.location = deck.pdf_url;
    else window.location.assign(deck.pdf_url);
  }

  function saveTitle(material) {
    const title = (titles[material.id] ?? material.title).trim();
    if (title === material.title) return;
    if (!title) {
      setTitles((current) => ({ ...current, [material.id]: material.title }));
      return;
    }
    change(`title-${material.id}`, () => supabase.from("course_materials").update({ title }).eq("id", material.id), { success: "Deck title saved." });
  }

  // Writes the new positions one deck at a time and stops at the first failure. The page
  // refreshes either way so it shows the order actually saved.
  function move(index, toIndex) {
    const changes = reorderedPositions(materials, index, toIndex);
    if (!changes.length) return;
    change("move", async () => {
      for (const { id, position } of changes) {
        const result = await supabase.from("course_materials").update({ position }).eq("id", id);
        if (result.error) return result;
      }
      return { data: true };
    }, { fallback: "The new order couldn’t be fully saved. Check the order below and try again." }, { refreshOnFailure: true });
  }

  async function remove(material) {
    const count = readingCounts[material.id] || 0;
    const warning = count ? ` Its ${count} reading question${count === 1 ? "" : "s"} will be deleted too.` : "";
    if (!window.confirm(`Remove “${material.title}” from ${course.code}?${warning} Past attempts are not affected.`)) return;
    const removed = await change(`remove-${material.id}`, () => supabase.from("course_materials").delete().eq("id", material.id), { success: "Deck removed." });
    const path = removed && materialStoragePathFromUrl(material.pdf_url);
    if (path) await removeStoredFiles(supabase, COURSE_PDF_BUCKET, [path]);
  }

  return (
    <section className="tp-card tp-form-card course-decks">
      <div className="tp-label form-section-label--tight">Reading decks</div>
      <p className="course-admin__hint">Learners must open every deck before the assessment. AI suggestions need decks under {FREE_PDF_PARSER_LIMIT_TEXT}.</p>
      {notices}

      <ol className="course-decks__list">
        {materials.map((material, index) => (
          <li key={material.id} className="course-decks__row">
            <span className="course-decks__number">{index + 1}</span>
            <input className="tp-input" aria-label={`Title of deck ${index + 1}`} value={titles[material.id] ?? material.title} disabled={readOnly || Boolean(busy)}
              onChange={(event) => setTitles((current) => ({ ...current, [material.id]: event.target.value }))}
              onBlur={() => saveTitle(material)}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
            <span className="course-decks__meta">{readingCounts[material.id] || 0} reading q.</span>
            <button type="button" className="tp-btn tp-btn-ghost" onClick={() => open(material)}>Open</button>
            {!readOnly && <>
              <button type="button" className="tp-btn tp-btn-ghost" aria-label={`Move ${material.title} up`} disabled={Boolean(busy) || index === 0} onClick={() => move(index, index - 1)}>↑</button>
              <button type="button" className="tp-btn tp-btn-ghost" aria-label={`Move ${material.title} down`} disabled={Boolean(busy) || index === materials.length - 1} onClick={() => move(index, index + 1)}>↓</button>
              <button type="button" className="tp-btn tp-btn-ghost" aria-label={`Remove ${material.title}`} disabled={Boolean(busy)} onClick={() => remove(material)}>{busy === `remove-${material.id}` ? "…" : "×"}</button>
            </>}
          </li>
        ))}
        {materials.length === 0 && <li className="chip-list__empty">No decks yet. Learners will see an empty reader until you add one.</li>}
      </ol>

      {!readOnly && (
        <label className="tp-btn tp-btn-ghost course-decks__upload" aria-disabled={Boolean(busy)}>
          {busy === "upload" ? "Uploading…" : "+ Add PDF decks"}
          <input type="file" accept="application/pdf,.pdf" multiple disabled={Boolean(busy)} onChange={addDecks} hidden />
        </label>
      )}
    </section>
  );
}
