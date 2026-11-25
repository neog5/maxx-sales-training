"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COURSE_PDF_BUCKET, COURSE_VIDEO_BUCKET, deckFileError, formatDuration, isVideo, reorderedPositions, storedMaterialFile, titleFromFileName, uploadCourseDeck, videoFileError, withSignedMaterialUrls } from "@/lib/course-materials";
import { FREE_PDF_PARSER_LIMIT_TEXT } from "@/lib/question-suggestions";
import { createClient } from "@/lib/supabase/client";
import { readVideoDuration, uploadCourseVideo } from "@/lib/video-upload";
import useAdminMutation from "../../useAdminMutation";
import { removeStoredFiles } from "@/lib/storage";

// The course's reading materials, PDF decks and videos: learners go through them in this
// order before the assessment. Materials come from the server, so each change re-renders the
// page from there.
export default function CourseMaterialsClient({ course, materials, readingCounts, readOnly }) {
  const supabase = createClient();
  const router = useRouter();
  const { run, busy, fail, notices } = useAdminMutation();
  const [titles, setTitles] = useState({});
  const [videoProgress, setVideoProgress] = useState(0);

  async function change(label, action, messages, { refreshOnFailure = false } = {}) {
    const data = await run(label, action, messages);
    if (data || refreshOnFailure) router.refresh();
    return data;
  }

  const nextPosition = () => Math.max(0, ...materials.map((material) => material.position)) + 1;

  // Uploads each PDF and adds it after the current last material. Stops at the first failure;
  // decks added before it stay, so the page refreshes either way.
  async function uploadDecks(files) {
    let position = nextPosition() - 1;
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

  // Uploads one video (resumable, with progress) and adds it after the current last material.
  async function uploadVideo(file) {
    setVideoProgress(0);
    const duration = await readVideoDuration(file);
    const path = await uploadCourseVideo(supabase, course.code, file, setVideoProgress);
    const result = await supabase.from("course_materials").insert({
      course_id: course.id, position: nextPosition(), title: titleFromFileName(file.name), kind: "video", video_path: path, duration_seconds: duration,
    });
    if (result.error) await removeStoredFiles(supabase, COURSE_VIDEO_BUCKET, [path]);
    return result.error ? result : { data: true };
  }

  function addVideo(event) {
    const [file] = Array.from(event.target.files || []);
    event.target.value = "";
    if (!file) return;
    const fileError = videoFileError(file);
    if (fileError) {
      fail(fileError);
      return;
    }
    change("upload-video", () => uploadVideo(file),
      { success: "Video added. Give it a clear title below.", fallback: "The video couldn’t be uploaded. Check your connection and try again." },
      { refreshOnFailure: true });
  }

  // The buckets are private, so each "Open" gets a fresh link that works for an hour.
  // The tab is opened first, while the click still counts, so pop-up blockers allow it.
  async function open(material) {
    const tab = window.open("", "_blank");
    const [signed] = await withSignedMaterialUrls(supabase, [material], 60 * 60);
    const url = isVideo(signed) ? signed.video_url : signed.pdf_url;
    if (!url) {
      tab?.close();
      fail("This file couldn’t be opened. Try again, or remove it and upload it again.");
      return;
    }
    if (tab) tab.location = url;
    else window.location.assign(url);
  }

  function saveTitle(material) {
    const title = (titles[material.id] ?? material.title).trim();
    if (title === material.title) return;
    if (!title) {
      setTitles((current) => ({ ...current, [material.id]: material.title }));
      return;
    }
    change(`title-${material.id}`, () => supabase.from("course_materials").update({ title }).eq("id", material.id), { success: "Title saved." });
  }

  // Writes the new positions one material at a time and stops at the first failure. The page
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
    const removed = await change(`remove-${material.id}`, () => supabase.from("course_materials").delete().eq("id", material.id), { success: isVideo(material) ? "Video removed." : "Deck removed." });
    const file = removed && storedMaterialFile(material);
    if (file) await removeStoredFiles(supabase, file.bucket, [file.path]);
  }

  const uploading = busy === "upload" || busy === "upload-video";

  return (
    <section className="tp-card tp-form-card course-decks">
      <div className="tp-label form-section-label--tight">Course material</div>
      <p className="course-admin__hint">Learners open every deck and every video before the assessment. Videos have no reading questions or minimum time. AI suggestions need PDF decks under {FREE_PDF_PARSER_LIMIT_TEXT}.</p>
      {notices}

      <ol className="course-decks__list">
        {materials.map((material, index) => (
          <li key={material.id} className="course-decks__row">
            <span className="course-decks__number" title={isVideo(material) ? "Video" : "PDF deck"}>{index + 1}</span>
            <input className="tp-input" aria-label={`Title of item ${index + 1}`} value={titles[material.id] ?? material.title} disabled={readOnly || Boolean(busy)}
              onChange={(event) => setTitles((current) => ({ ...current, [material.id]: event.target.value }))}
              onBlur={() => saveTitle(material)}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
            <span className="course-decks__meta">
              {isVideo(material)
                ? ["Video", formatDuration(material.duration_seconds)].filter(Boolean).join(" · ")
                : `PDF · ${readingCounts[material.id] || 0} reading q.`}
            </span>
            <button type="button" className="tp-btn tp-btn-ghost" onClick={() => open(material)}>Open</button>
            {!readOnly && <>
              <button type="button" className="tp-btn tp-btn-ghost" aria-label={`Move ${material.title} up`} disabled={Boolean(busy) || index === 0} onClick={() => move(index, index - 1)}>↑</button>
              <button type="button" className="tp-btn tp-btn-ghost" aria-label={`Move ${material.title} down`} disabled={Boolean(busy) || index === materials.length - 1} onClick={() => move(index, index + 1)}>↓</button>
              <button type="button" className="tp-btn tp-btn-ghost" aria-label={`Remove ${material.title}`} disabled={Boolean(busy)} onClick={() => remove(material)}>{busy === `remove-${material.id}` ? "…" : "×"}</button>
            </>}
          </li>
        ))}
        {materials.length === 0 && <li className="chip-list__empty">Nothing yet. Learners will see an empty reader until you add a PDF deck or a video.</li>}
      </ol>

      {!readOnly && (
        <div className="course-decks__actions">
          <label className="tp-btn tp-btn-ghost course-decks__upload" aria-disabled={Boolean(busy)}>
            {busy === "upload" ? "Uploading…" : "+ Add PDF decks"}
            <input type="file" accept="application/pdf,.pdf" multiple disabled={Boolean(busy)} onChange={addDecks} hidden />
          </label>
          <label className="tp-btn tp-btn-ghost course-decks__upload" aria-disabled={Boolean(busy)}>
            {busy === "upload-video" ? `Uploading video… ${videoProgress}%` : "+ Add video"}
            <input type="file" accept="video/mp4,.mp4" disabled={Boolean(busy)} onChange={addVideo} hidden />
          </label>
          {busy === "upload-video" && (
            <div className="course-decks__progress" role="progressbar" aria-label="Video upload" aria-valuenow={videoProgress} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${videoProgress}%` }} />
            </div>
          )}
          {!uploading && <span className="course-decks__meta">MP4, up to 2 GB. 720p recommended.</span>}
        </div>
      )}
    </section>
  );
}
