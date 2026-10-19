"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { requiredCoursesByUser } from "@/lib/compliance.mjs";

// Lists the courses this person must complete and why. Admins can change the
// person's groups and add one-off course assignments here.
export default function RequiredTraining({ personId, canEdit, groups, initialGroupIds, courses, initialAssignments, passedCourseIds }) {
  const supabase = createClient();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [groupToAdd, setGroupToAdd] = useState("");
  const [courseToAdd, setCourseToAdd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = saving || refreshing;

  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const passed = new Set(passedCourseIds);
  const memberGroupIds = new Set(initialGroupIds);
  const requiredIds = requiredCoursesByUser({
    assignments: initialAssignments,
    memberships: initialGroupIds.map((groupId) => ({ group_id: groupId, user_id: personId })),
    courses,
  }).get(personId) || new Set();
  const reasonsFor = (courseId) => initialAssignments.filter((assignment) => assignment.course_id === courseId
    && (assignment.user_id === personId || memberGroupIds.has(assignment.group_id)));
  const required = courses
    .filter((course) => requiredIds.has(course.id))
    .map((course) => ({ ...course, reasons: reasonsFor(course.id), passed: passed.has(course.id) }));
  const completed = required.filter((course) => course.passed).length;
  const directCourseIds = new Set(initialAssignments.filter((assignment) => assignment.user_id === personId).map((assignment) => assignment.course_id));

  async function mutate(action) {
    setSaving(true);
    setError("");
    const { error: mutationError } = await action();
    setSaving(false);
    if (mutationError) {
      setError(mutationError.message || "Something went wrong. Please try again.");
      return;
    }
    setGroupToAdd("");
    setCourseToAdd("");
    startRefresh(() => router.refresh());
  }

  return (
    <section className="profile-report-section">
      <div className="section-heading-row">
        <div>
          <div className="tp-label">Required training</div>
          <span>{required.length ? `${completed} of ${required.length} required courses passed` : "No courses assigned"}</span>
        </div>
        {required.length > 0 && (
          <span className={`training-status training-status--${completed === required.length ? "compliant" : "non_compliant"}`}>
            <span aria-hidden="true"></span>{completed === required.length ? "Compliant" : "Not compliant"}
          </span>
        )}
      </div>

      <div className="tp-card tp-form-card required-training">
        <div className="course-admin__subhead" style={{ marginTop: 0 }}>Groups</div>
        <div className="chip-list">
          {initialGroupIds.map((groupId) => (
            <span className="chip" key={groupId}>
              {canEdit ? <Link href={`/admin/groups?group=${groupId}`}>{groupNames.get(groupId)}</Link> : groupNames.get(groupId)}
              {canEdit && (
                <button type="button" aria-label={`Remove from ${groupNames.get(groupId)}`} disabled={busy}
                  onClick={() => mutate(() => supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", personId))}>×</button>
              )}
            </span>
          ))}
          {initialGroupIds.length === 0 && <span className="chip-list__empty">Not in any group</span>}
        </div>
        {canEdit && (
          <div className="inline-add">
            <select className="tp-input" aria-label="Group to join" value={groupToAdd} onChange={(event) => setGroupToAdd(event.target.value)}>
              <option value="">Add to a group…</option>
              {groups.filter((group) => !memberGroupIds.has(group.id)).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
            <button type="button" className="tp-btn tp-btn-ghost" disabled={!groupToAdd || busy}
              onClick={() => mutate(() => supabase.from("group_members").insert({ group_id: groupToAdd, user_id: personId }))}>Add</button>
          </div>
        )}

        <div className="course-admin__subhead">Courses</div>
        <div className="required-course-list">
          {required.map((course) => (
            <div className="required-course" key={course.id}>
              <span className={`required-course__mark ${course.passed ? "is-passed" : ""}`} aria-label={course.passed ? "Passed" : "Not yet passed"}>{course.passed ? "✓" : ""}</span>
              <span className="required-course__name">
                <strong>{course.title}</strong>
                <small>
                  <span className="tp-mono">{course.code}</span> · {course.reasons.map((reason) => (reason.group_id ? groupNames.get(reason.group_id) : "Assigned individually")).join(", ")}
                </small>
              </span>
              <span className={course.passed ? "required-course__status is-passed" : "required-course__status"}>{course.passed ? "Passed" : "Outstanding"}</span>
              {canEdit && directCourseIds.has(course.id) && (
                <button type="button" className="tp-btn tp-btn-ghost required-course__remove" disabled={busy}
                  onClick={() => mutate(() => supabase.from("course_assignments").delete().eq("course_id", course.id).eq("user_id", personId))}>
                  Remove individual assignment
                </button>
              )}
            </div>
          ))}
          {required.length === 0 && <span className="chip-list__empty">Nothing assigned yet.</span>}
        </div>
        {canEdit && (
          <div className="inline-add">
            <select className="tp-input" aria-label="Course to assign" value={courseToAdd} onChange={(event) => setCourseToAdd(event.target.value)}>
              <option value="">Assign an extra course to this person…</option>
              {courses.filter((course) => !directCourseIds.has(course.id)).map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
            </select>
            <button type="button" className="tp-btn tp-btn-ghost" disabled={!courseToAdd || busy}
              onClick={() => mutate(() => supabase.from("course_assignments").insert({ course_id: courseToAdd, user_id: personId }))}>Assign</button>
          </div>
        )}
        {error && <div className="notice notice--error" role="alert" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>}
      </div>
    </section>
  );
}
