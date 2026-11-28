"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LocalDate from "@/components/LocalDate";
import { describeAuditEntry } from "@/lib/audit";
import { displayName } from "@/lib/people";
import { createClient } from "@/lib/supabase/client";
import useAdminMutation from "../../useAdminMutation";
import CourseAccessPanel from "./CourseAccessPanel";
import CourseMaterialsClient from "./CourseMaterialsClient";

function detailsFrom(course) {
  return {
    title: course.title,
    description: course.description || "",
    pass_threshold: course.pass_threshold,
    read_minutes: course.read_seconds / 60,
    view_only: course.view_only,
  };
}

// A course's details, assignments, decks and history (Archive and Delete are in CourseActions). The assignments, decks, header and
// history all come from the server, so each change re-renders the page from there.
export default function CourseAdminClient({ course, materials, readingCounts, assignments, groups, people, history }) {
  const supabase = createClient();
  const router = useRouter();
  const { run, busy, fail, notices } = useAdminMutation();
  const archived = Boolean(course.archived_at);
  const [details, setDetails] = useState(() => detailsFrom(course));

  const names = useMemo(() => ({
    groups: new Map(groups.map((group) => [group.id, group.name])),
    people: new Map(people.map((person) => [person.id, displayName(person)])),
    courses: new Map([[course.id, course.title]]),
  }), [groups, people, course.id, course.title]);

  // Runs a change and, when it worked, re-renders the page with fresh server data.
  async function change(label, action, messages) {
    const data = await run(label, action, messages);
    if (data) router.refresh();
    return data;
  }

  function updateDetail(field, value) {
    setDetails((current) => ({ ...current, [field]: value }));
  }

  function saveDetails(event) {
    event.preventDefault();
    if (!details.title.trim()) {
      fail("Enter a course title.");
      return;
    }
    change("details", () => supabase.from("courses").update({
      title: details.title.trim(),
      description: details.description.trim() || null,
      pass_threshold: Number(details.pass_threshold),
      read_seconds: Math.round(Number(details.read_minutes) * 60),
      view_only: details.view_only,
    }).eq("id", course.id), { success: "Course details saved." });
  }

  return (
    <div className="course-admin">
      {notices}

      <div className="course-admin__grid">
        <form className="tp-card tp-form-card" onSubmit={saveDetails}>
          <div className="tp-label form-section-label">Course details</div>
          <fieldset disabled={archived || busy === "details"} className="course-admin__fieldset">
            <label className="tp-form-field"><div className="tp-label form-label">Title</div><input className="tp-input" value={details.title} onChange={(event) => updateDetail("title", event.target.value)} required /></label>
            <label className="tp-form-field"><div className="tp-label form-label">Description</div><textarea className="tp-input" rows={3} value={details.description} onChange={(event) => updateDetail("description", event.target.value)} /></label>
            <div className="tp-form-grid tp-form-grid--equal">
              <label className="tp-form-field"><div className="tp-label form-label">Passing score (%)</div><input className="tp-input" type="number" min="0" max="100" value={details.pass_threshold} disabled={details.view_only} onChange={(event) => updateDetail("pass_threshold", event.target.value)} required /></label>
              <label className="tp-form-field"><div className="tp-label form-label">Minimum reading time per PDF deck (minutes)</div><input className="tp-input" type="number" min="0" step="0.5" value={details.read_minutes} onChange={(event) => updateDetail("read_minutes", event.target.value)} required /></label>
            </div>
            <label className="check-row check-row--last">
              <input type="checkbox" checked={details.view_only} onChange={(event) => updateDetail("view_only", event.target.checked)} />
              No assessment: certificate when the material is done
            </label>
            <div className="tp-form-actions"><button className="tp-btn tp-btn-primary" type="submit">{busy === "details" ? "Saving…" : "Save details"}</button></div>
          </fieldset>
        </form>

        <CourseAccessPanel course={course} assignments={assignments} groups={groups} people={people} archived={archived} busy={busy} change={change} supabase={supabase} />
      </div>

      <CourseMaterialsClient course={course} materials={materials} readingCounts={readingCounts} readOnly={archived} />

      <section className="profile-report-section">
        <div className="section-heading-row"><div><div className="tp-label">History</div></div></div>
        <div className="tp-card audit-list">
          {history.map((entry) => (
            <div className="audit-list__row" key={entry.id}>
              <span>{describeAuditEntry(entry, names)}</span>
              <small>{entry.actor_name || "System"} · <LocalDate value={entry.created_at} withTime /></small>
            </div>
          ))}
          {history.length === 0 && <div className="admin-insight-empty">No recorded changes yet.</div>}
        </div>
      </section>
    </div>
  );
}
