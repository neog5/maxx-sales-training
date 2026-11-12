"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LocalDate from "@/components/LocalDate";
import MemberList from "@/components/MemberList";
import MultiPicker from "@/components/MultiPicker";
import { describeAuditEntry } from "@/lib/audit";
import { COURSE_PDF_BUCKET, materialStoragePathFromUrl } from "@/lib/course-materials";
import { byName, displayName } from "@/lib/people";
import { groupItems, personItems } from "@/lib/picker-items";
import { QUESTION_IMAGE_BUCKET } from "@/lib/question-images";
import { isSuperAdmin } from "@/lib/roles";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";
import useAdminMutation from "../../useAdminMutation";
import CourseMaterialsClient from "./CourseMaterialsClient";
import { removeStoredFiles } from "@/lib/storage";

const ASSIGNMENT_NOUNS = { group_id: ["training group", "training groups"], user_id: ["person", "people"] };

function detailsFrom(course) {
  return {
    title: course.title,
    description: course.description || "",
    pass_threshold: course.pass_threshold,
    read_seconds: course.read_seconds,
    is_active: course.is_active,
    view_only: course.view_only,
  };
}

// Deletes a deleted course's deck PDFs and question images. Best effort: the course is
// already gone, so a failure only leaves unused files behind.
async function removeCourseFiles(supabase, course, materials) {
  await removeStoredFiles(supabase, COURSE_PDF_BUCKET, materials.map((material) => materialStoragePathFromUrl(material.pdf_url)));
  const { data: files } = await supabase.storage.from(QUESTION_IMAGE_BUCKET).list(course.id, { limit: 1000 });
  await removeStoredFiles(supabase, QUESTION_IMAGE_BUCKET, (files || []).map((file) => `${course.id}/${file.name}`));
}

// A course's details, assignments, decks and history. The assignments, decks, header and
// history all come from the server, so each change re-renders the page from there.
export default function CourseAdminClient({ course, viewerRole, recordCount, materials, readingCounts, assignments, groups, people, history }) {
  const supabase = createClient();
  const router = useRouter();
  const { run, busy, fail, notices } = useAdminMutation();
  const archived = Boolean(course.archived_at);
  const [details, setDetails] = useState(() => detailsFrom(course));

  const groupNames = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);
  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const personOptions = useMemo(() => personItems(people), [people]);
  const groupOptions = useMemo(() => groupItems(groups), [groups]);
  const names = {
    groups: groupNames,
    people: new Map(people.map((person) => [person.id, displayName(person)])),
    courses: new Map([[course.id, course.title]]),
  };
  const assignedGroups = assignments.filter((assignment) => assignment.group_id);
  const assignedPeople = assignments.filter((assignment) => assignment.user_id);
  const assignedPeopleList = assignedPeople.map((assignment) => peopleById.get(assignment.user_id)).filter(Boolean).sort(byName);

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
      read_seconds: Number(details.read_seconds),
      is_active: details.is_active,
      view_only: details.view_only,
    }).eq("id", course.id), { success: "Course details saved." });
  }

  function addAssignments(field, ids) {
    const [one, many] = ASSIGNMENT_NOUNS[field];
    return change("assign", () => supabase.from("course_assignments").insert(ids.map((id) => ({ course_id: course.id, [field]: id }))),
      { success: `Assigned to ${ids.length} ${ids.length === 1 ? one : many}.` });
  }

  function removeAssignment(assignment) {
    return change("assign", () => supabase.from("course_assignments").delete().eq("id", assignment.id));
  }

  function setArchived(nextArchived) {
    const prompt = nextArchived
      ? `Archive ${course.code}? Learners will no longer see it or be required to complete it. All training records are kept, and you can restore it later.`
      : `Restore ${course.code} from the archive?`;
    if (!window.confirm(prompt)) return;
    change("archive", () => supabase.from("courses").update({ archived_at: nextArchived ? new Date().toISOString() : null }).eq("id", course.id),
      { success: nextArchived ? "Course archived." : "Course restored." });
  }

  async function deleteCourse() {
    const typed = window.prompt(`This permanently deletes ${course.code}, its questions and its assignments. Type the course code to confirm.`);
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== course.code.toUpperCase()) {
      fail("The course code didn’t match, so nothing was deleted.");
      return;
    }
    const deleted = await run("delete", async () => {
      const result = await supabase.from("courses").delete().eq("id", course.id).select("id");
      if (!result.error && !result.data?.length) throw new Error("Only a super admin can delete courses.");
      return result;
    }, { inUse: "This course has training records, so it can only be archived." });
    if (!deleted) return;
    await removeCourseFiles(supabase, course, materials);
    router.push(routes.adminCourses);
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
              <label className="tp-form-field"><div className="tp-label form-label">Minimum reading time (seconds)</div><input className="tp-input" type="number" min="0" value={details.read_seconds} onChange={(event) => updateDetail("read_seconds", event.target.value)} required /></label>
            </div>
            <label className="check-row">
              <input type="checkbox" checked={details.view_only} onChange={(event) => updateDetail("view_only", event.target.checked)} />
              Reading only: no test, the certificate is issued when the reading is finished
            </label>
            <label className="check-row check-row--last">
              <input type="checkbox" checked={details.is_active} onChange={(event) => updateDetail("is_active", event.target.checked)} />
              Visible to learners
            </label>
            <div className="tp-form-actions"><button className="tp-btn tp-btn-primary" type="submit">{busy === "details" ? "Saving…" : "Save details"}</button></div>
          </fieldset>
        </form>

        <section className="tp-card tp-form-card">
          <div className="tp-label form-section-label--tight">Who must complete this course</div>
          <p className="course-admin__hint">Everyone in an assigned training group must complete it. Add a single person for one-off requirements.</p>

          <div className="course-admin__subhead">Training groups</div>
          <div className="chip-list">
            {assignedGroups.map((assignment) => (
              <span className="chip" key={assignment.id}>
                {groupNames.get(assignment.group_id) || "Group"}
                {!archived && <button type="button" aria-label={`Remove ${groupNames.get(assignment.group_id)}`} disabled={Boolean(busy)} onClick={() => removeAssignment(assignment)}>×</button>}
              </span>
            ))}
            {assignedGroups.length === 0 && <span className="chip-list__empty">No training groups assigned</span>}
          </div>
          {!archived && (
            <MultiPicker items={groupOptions} excludeIds={assignedGroups.map((assignment) => assignment.group_id)} onAdd={(ids) => addAssignments("group_id", ids)}
              placeholder="Assign training groups…" addLabel="Assign" noun="training group" busy={busy === "assign"} />
          )}

          <div className="course-admin__subhead">Individual people</div>
          {!archived && (
            <MultiPicker items={personOptions} excludeIds={assignedPeople.map((assignment) => assignment.user_id)} onAdd={(ids) => addAssignments("user_id", ids)}
              placeholder="Assign people by name or email…" addLabel="Assign" noun="person" busy={busy === "assign"} pasteEmails />
          )}
          <MemberList
            people={assignedPeopleList}
            onRemove={archived ? undefined : (person) => removeAssignment(assignedPeople.find((assignment) => assignment.user_id === person.id))}
            busy={Boolean(busy)}
            emptyText="No individual assignments"
          />
        </section>
      </div>

      <CourseMaterialsClient course={course} materials={materials} readingCounts={readingCounts} readOnly={archived} />

      <section className="tp-card course-admin__danger">
        <div>
          <strong>{archived ? "Restore course" : "Archive course"}</strong>
          <span>
            {archived
              ? "Restoring makes the course available again, and its assignments count toward compliance again."
              : "Hides the course from learners and removes it from compliance checks. Every reading session, attempt and answer is kept."}
          </span>
        </div>
        <button type="button" className="tp-btn tp-btn-ghost" disabled={Boolean(busy)} onClick={() => setArchived(!archived)}>
          {busy === "archive" ? "Saving…" : archived ? "Restore course" : "Archive course"}
        </button>
      </section>

      {isSuperAdmin(viewerRole) && (
        <section className="tp-card course-admin__danger is-delete">
          <div>
            <strong>Delete course</strong>
            <span>
              {recordCount > 0
                ? "This course has training records, so it can’t be deleted. Archive it instead."
                : "Permanently removes the course, its questions, its assignments and its PDF decks. The deletion is recorded in the audit log."}
            </span>
          </div>
          <button type="button" className="tp-btn tp-btn-danger" disabled={recordCount > 0 || Boolean(busy)} onClick={deleteCourse}>
            {busy === "delete" ? "Deleting…" : "Delete course"}
          </button>
        </section>
      )}

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
