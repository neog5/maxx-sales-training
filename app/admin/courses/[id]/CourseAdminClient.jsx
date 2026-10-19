"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MemberList from "@/components/MemberList";
import MultiPicker from "@/components/MultiPicker";
import { createClient } from "@/lib/supabase/client";
import { groupItems, personItems } from "@/lib/picker-items.mjs";
import { describeAuditEntry } from "@/lib/audit.mjs";
import { formatDateTime } from "@/lib/format.mjs";
import { isSuperAdmin } from "@/lib/roles.mjs";

function coursePdfPath(pdfUrl) {
  const marker = "/storage/v1/object/public/course-pdfs/";
  const index = pdfUrl?.indexOf(marker) ?? -1;
  return index >= 0 ? decodeURIComponent(pdfUrl.slice(index + marker.length)) : null;
}

export default function CourseAdminClient({ course, viewerRole, recordCount, initialAssignments, groups, people, history }) {
  const supabase = createClient();
  const router = useRouter();
  const archived = Boolean(course.archived_at);
  const [details, setDetails] = useState({
    title: course.title,
    description: course.description || "",
    pass_threshold: course.pass_threshold,
    read_seconds: course.read_seconds,
    is_active: course.is_active,
  });
  const [assignments, setAssignments] = useState(initialAssignments);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

  const groupNames = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);
  const peopleNames = useMemo(() => new Map(people.map((person) => [person.id, person.full_name])), [people]);
  const names = { groups: groupNames, people: peopleNames, courses: new Map([[course.id, course.title]]) };
  const assignedGroups = assignments.filter((assignment) => assignment.group_id);
  const assignedPeople = assignments.filter((assignment) => assignment.user_id);
  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const personOptions = useMemo(() => personItems(people), [people]);
  const groupOptions = useMemo(() => groupItems(groups), [groups]);
  const assignedPeopleList = assignedPeople
    .map((assignment) => peopleById.get(assignment.user_id))
    .filter(Boolean)
    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

  async function run(label, action, success, { refresh = true } = {}) {
    setBusy(label);
    setMessage({ type: "", text: "" });
    try {
      await action();
      if (success) setMessage({ type: "success", text: success });
      if (refresh) router.refresh();
      return true;
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Something went wrong. Please try again." });
      return false;
    } finally {
      setBusy("");
    }
  }

  function saveDetails(event) {
    event.preventDefault();
    if (!details.title.trim()) {
      setMessage({ type: "error", text: "Enter a course title." });
      return;
    }
    run("details", async () => {
      const { error } = await supabase.from("courses").update({
        title: details.title.trim(),
        description: details.description.trim() || null,
        pass_threshold: Number(details.pass_threshold),
        read_seconds: Number(details.read_seconds),
        is_active: details.is_active,
      }).eq("id", course.id);
      if (error) throw error;
    }, "Course details saved.");
  }

  function addAssignments(field, ids) {
    return run("assign", async () => {
      const { data, error } = await supabase
        .from("course_assignments")
        .insert(ids.map((id) => ({ course_id: course.id, [field]: id })))
        .select("id, group_id, user_id, assigned_at");
      if (error) throw error;
      setAssignments((current) => [...current, ...data]);
    }, `Assigned to ${ids.length} ${field === "group_id" ? (ids.length === 1 ? "training group" : "training groups") : (ids.length === 1 ? "person" : "people")}.`);
  }

  function removeAssignment(assignment) {
    run("assign", async () => {
      const { error } = await supabase.from("course_assignments").delete().eq("id", assignment.id);
      if (error) throw error;
      setAssignments((current) => current.filter((row) => row.id !== assignment.id));
    });
  }

  function setArchived(nextArchived) {
    const prompt = nextArchived
      ? `Archive ${course.code}? Learners will no longer see it or be required to complete it. All training records are kept, and you can restore it later.`
      : `Restore ${course.code} from the archive?`;
    if (!window.confirm(prompt)) return;
    run("archive", async () => {
      const { error } = await supabase
        .from("courses")
        .update({ archived_at: nextArchived ? new Date().toISOString() : null })
        .eq("id", course.id);
      if (error) throw error;
    }, nextArchived ? "Course archived." : "Course restored.");
  }

  function deleteCourse() {
    const typed = window.prompt(`This permanently deletes ${course.code}, its questions and its assignments. Type the course code to confirm.`);
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== course.code.toUpperCase()) {
      setMessage({ type: "error", text: "The course code didn’t match, so nothing was deleted." });
      return;
    }
    run("delete", async () => {
      const { data, error } = await supabase.from("courses").delete().eq("id", course.id).select("id");
      if (error) throw new Error(/foreign key/i.test(error.message) ? "This course has training records, so it can only be archived." : error.message);
      if (!data?.length) throw new Error("Only a super admin can delete courses.");
      // The course is gone; clean up its files on a best-effort basis.
      const pdfPath = coursePdfPath(course.pdf_url);
      if (pdfPath) await supabase.storage.from("course-pdfs").remove([pdfPath]);
      const { data: images } = await supabase.storage.from("question-images").list(course.id, { limit: 1000 });
      if (images?.length) await supabase.storage.from("question-images").remove(images.map((image) => `${course.id}/${image.name}`));
      router.push("/admin/courses");
    }, "", { refresh: false });
  }

  return (
    <div className="course-admin">
      {message.text && (
        <div className={message.type === "error" ? "notice notice--error" : "notice notice--success"} role={message.type === "error" ? "alert" : "status"}>{message.text}</div>
      )}

      <div className="course-admin__grid">
        <form className="tp-card tp-form-card" onSubmit={saveDetails}>
          <div className="tp-label" style={{ marginBottom: 14 }}>Course details</div>
          <fieldset disabled={archived || busy === "details"} className="course-admin__fieldset">
            <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Title</div><input className="tp-input" value={details.title} onChange={(event) => setDetails({ ...details, title: event.target.value })} required /></label>
            <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Description</div><textarea className="tp-input" rows={3} value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} /></label>
            <div className="tp-form-grid tp-form-grid--equal">
              <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Passing score (%)</div><input className="tp-input" type="number" min="0" max="100" value={details.pass_threshold} onChange={(event) => setDetails({ ...details, pass_threshold: event.target.value })} required /></label>
              <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Minimum reading time (seconds)</div><input className="tp-input" type="number" min="0" value={details.read_seconds} onChange={(event) => setDetails({ ...details, read_seconds: event.target.value })} required /></label>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 18 }}>
              <input type="checkbox" checked={details.is_active} onChange={(event) => setDetails({ ...details, is_active: event.target.checked })} />
              Visible to learners
            </label>
            <div className="tp-form-actions"><button className="tp-btn tp-btn-primary" type="submit">{busy === "details" ? "Saving…" : "Save details"}</button></div>
          </fieldset>
        </form>

        <section className="tp-card tp-form-card">
          <div className="tp-label" style={{ marginBottom: 4 }}>Who must complete this course</div>
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
                : "Permanently removes the course, its questions, its assignments and its PDF. The deletion is recorded in the audit log."}
            </span>
          </div>
          <button type="button" className="tp-btn tp-btn-danger" disabled={recordCount > 0 || Boolean(busy)} onClick={deleteCourse}>
            {busy === "delete" ? "Deleting…" : "Delete course"}
          </button>
        </section>
      )}

      <section className="profile-report-section">
        <div className="section-heading-row"><div><div className="tp-label">History</div><span>Changes to this course and its assignments</span></div></div>
        <div className="tp-card audit-list">
          {history.map((entry) => (
            <div className="audit-list__row" key={entry.id}>
              <span>{describeAuditEntry(entry, names)}</span>
              <small>{entry.actor_name || "System"} · {formatDateTime(entry.created_at)}</small>
            </div>
          ))}
          {history.length === 0 && <div className="admin-insight-empty">No recorded changes yet.</div>}
        </div>
      </section>
    </div>
  );
}
