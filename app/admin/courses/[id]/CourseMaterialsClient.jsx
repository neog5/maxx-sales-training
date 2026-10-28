"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { COURSE_PDF_BUCKET, materialStoragePath, materialStoragePathFromUrl, reorderedPositions, titleFromFileName } from "@/lib/course-materials.mjs";

// The course's reading decks: learners read them in this order before the assessment.
export default function CourseMaterialsClient({ course, materials, readingCounts, readOnly }) {
  const supabase = createClient();
  const router = useRouter();
  const [titles, setTitles] = useState(() => Object.fromEntries(materials.map((material) => [material.id, material.title])));
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

  async function run(label, action, success) {
    setBusy(label);
    setMessage({ type: "", text: "" });
    try {
      await action();
      if (success) setMessage({ type: "success", text: success });
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Something went wrong. Please try again." });
    } finally {
      setBusy("");
    }
  }

  function addDecks(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (files.some((file) => file.type !== "application/pdf")) {
      setMessage({ type: "error", text: "Decks must be PDF files." });
      return;
    }
    run("upload", async () => {
      let position = Math.max(0, ...materials.map((material) => material.position));
      for (const file of files) {
        const path = materialStoragePath(course.code, file.name);
        const { error: uploadError } = await supabase.storage.from(COURSE_PDF_BUCKET).upload(path, file, { contentType: "application/pdf" });
        if (uploadError) throw uploadError;
        const pdfUrl = supabase.storage.from(COURSE_PDF_BUCKET).getPublicUrl(path).data.publicUrl;
        position += 1;
        const { error } = await supabase.from("course_materials").insert({ course_id: course.id, position, title: titleFromFileName(file.name), pdf_url: pdfUrl });
        if (error) {
          await supabase.storage.from(COURSE_PDF_BUCKET).remove([path]);
          throw error;
        }
      }
    }, files.length === 1 ? "Deck added. Give it a clear title below." : `${files.length} decks added. Give them clear titles below.`);
  }

  function saveTitle(material) {
    const title = (titles[material.id] || "").trim();
    if (title === material.title) return;
    if (!title) {
      setTitles((current) => ({ ...current, [material.id]: material.title }));
      return;
    }
    run(`title-${material.id}`, async () => {
      const { error } = await supabase.from("course_materials").update({ title }).eq("id", material.id);
      if (error) throw error;
    }, "Deck title saved.");
  }

  function move(index, toIndex) {
    const changes = reorderedPositions(materials, index, toIndex);
    if (!changes.length) return;
    run("move", async () => {
      for (const { id, position } of changes) {
        const { error } = await supabase.from("course_materials").update({ position }).eq("id", id);
        if (error) throw error;
      }
    });
  }

  function remove(material) {
    const count = readingCounts[material.id] || 0;
    const warning = count ? ` Its ${count} reading question${count === 1 ? "" : "s"} will be deleted too.` : "";
    if (!window.confirm(`Remove “${material.title}” from ${course.code}?${warning} Past attempts are not affected.`)) return;
    run(`remove-${material.id}`, async () => {
      const { error } = await supabase.from("course_materials").delete().eq("id", material.id);
      if (error) throw error;
      const path = materialStoragePathFromUrl(material.pdf_url);
      if (path) await supabase.storage.from(COURSE_PDF_BUCKET).remove([path]);
    }, "Deck removed.");
  }

  return (
    <section className="tp-card tp-form-card course-decks">
      <div className="tp-label" style={{ marginBottom: 4 }}>Reading decks</div>
      <p className="course-admin__hint">Learners read these PDFs in order and must open every deck before the assessment. Keep each deck under 5 MB to use AI question suggestions.</p>
      {message.text && <div className={message.type === "error" ? "notice notice--error" : "notice notice--success"} role={message.type === "error" ? "alert" : "status"}>{message.text}</div>}

      <ol className="course-decks__list">
        {materials.map((material, index) => (
          <li key={material.id} className="course-decks__row">
            <span className="course-decks__number">{index + 1}</span>
            <input className="tp-input" aria-label={`Title of deck ${index + 1}`} value={titles[material.id] ?? material.title} disabled={readOnly || Boolean(busy)}
              onChange={(event) => setTitles((current) => ({ ...current, [material.id]: event.target.value }))}
              onBlur={() => saveTitle(material)}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
            <span className="course-decks__meta">{readingCounts[material.id] || 0} reading q.</span>
            <a className="tp-btn tp-btn-ghost" href={material.pdf_url} target="_blank" rel="noreferrer">Open</a>
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

      <style jsx>{`
        .course-decks { margin-top: 18px; }
        .course-decks__list { list-style: none; margin: 12px 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .course-decks__row { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto auto auto auto auto; gap: 8px; align-items: center; }
        .course-decks__number { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 7px; background: var(--accent-dim); color: var(--accent); font: 600 11.5px/1 'JetBrains Mono', monospace; }
        .course-decks__meta { color: var(--faint); font-size: 11.5px; white-space: nowrap; }
        .course-decks__upload { cursor: pointer; }
        @media (max-width: 700px) {
          .course-decks__row { grid-template-columns: 28px minmax(0, 1fr) auto auto auto; }
          .course-decks__meta, .course-decks__row a { display: none; }
        }
      `}</style>
    </section>
  );
}
