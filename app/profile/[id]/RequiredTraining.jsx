"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AddAsSelect, REQUIRED_HINT, RequiredSelect } from "@/components/AssignmentControls";
import MultiPicker from "@/components/MultiPicker";
import Notice from "@/components/Notice";
import useMutation from "@/hooks/useMutation";
import { COMPLIANCE_LABELS, complianceStatus } from "@/lib/compliance";
import { courseItems, groupItems } from "@/lib/picker-items";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

// Lists the courses this person must complete. `requiredCourseIds` comes from the
// database's required_courses(). Group membership and the reason for each course are
// shown only to admins and to the person themself (`showGroups`); admins can edit them.
// Reading-only courses have no test, so they are completed rather than passed.
const doneLabel = (course) => (course.view_only ? "Completed" : "Passed");

export default function RequiredTraining({ personId, canEdit, showGroups, groups, initialGroupIds, courses, requiredCourseIds, initialAssignments, passedCourseIds }) {
  const supabase = createClient();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const { run, busy: saving, error } = useMutation();
  const busy = Boolean(saving) || refreshing;

  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const passed = new Set(passedCourseIds);
  const requiredIds = new Set(requiredCourseIds);
  // initialAssignments already holds only this person's own and their groups' assignments.
  const reasonsFor = (courseId) => initialAssignments.filter((assignment) => assignment.course_id === courseId);
  const required = courses
    .filter((course) => requiredIds.has(course.id))
    .map((course) => ({ ...course, reasons: reasonsFor(course.id), passed: passed.has(course.id) }));
  const completed = required.filter((course) => course.passed).length;
  const status = complianceStatus(required.length, completed);
  // Optional: given to them (directly or through a group) but not required.
  const optionalIds = new Set(initialAssignments.filter((assignment) => !assignment.required).map((assignment) => assignment.course_id));
  const optional = courses
    .filter((course) => optionalIds.has(course.id) && !requiredIds.has(course.id) && course.is_active && !course.archived_at)
    .map((course) => ({ ...course, reasons: reasonsFor(course.id), passed: passed.has(course.id) }));
  const directAssignments = initialAssignments.filter((assignment) => assignment.user_id === personId);
  const directByCourse = new Map(directAssignments.map((assignment) => [assignment.course_id, assignment]));
  const directCourseIds = directAssignments.map((assignment) => assignment.course_id);
  const groupOptions = useMemo(() => groupItems(groups), [groups]);
  const courseOptions = useMemo(() => courseItems(courses), [courses]);
  const [addAs, setAddAs] = useState("required");

  // Saves, then re-reads the page's server data; stays busy until that refresh lands.
  async function mutate(label, action) {
    const saved = await run(label, action);
    if (saved) startRefresh(() => router.refresh());
    return Boolean(saved);
  }

  // Required/optional and Remove, for a course given to this person directly.
  function directControls(assignment, course) {
    return (
      <span className="access-row__actions">
        <RequiredSelect assignment={assignment} label={course.title} disabled={busy}
          onChange={(row, nextRequired) => mutate("assignment-required", () => supabase.from("course_assignments").update({ required: nextRequired }).eq("id", row.id))} />
        <button type="button" className="tp-btn tp-btn-ghost required-course__remove" disabled={busy}
          onClick={() => mutate("unassign-course", () => supabase.from("course_assignments").delete().eq("id", assignment.id))}>
          Remove
        </button>
      </span>
    );
  }

  return (
    <section className="profile-report-section">
      <div className="section-heading-row">
        <div>
          <div className="tp-label">Required training</div>
          <span>{required.length ? `${completed} of ${required.length} required courses done` : "No courses assigned"}</span>
        </div>
        {status !== "none" && (
          <span className={`training-status training-status--${status}`}>
            <span aria-hidden="true"></span>{COMPLIANCE_LABELS[status]}
          </span>
        )}
      </div>

      <div className="tp-card tp-form-card required-training">
        {showGroups && (
          <>
            <div className="course-admin__subhead course-admin__subhead--first">Training groups</div>
            <div className="chip-list">
              {initialGroupIds.map((groupId) => (
                <span className="chip" key={groupId}>
                  {canEdit ? <Link href={`${routes.trainingGroups}?group=${groupId}`}>{groupNames.get(groupId)}</Link> : groupNames.get(groupId)}
                  {canEdit && (
                    <button type="button" aria-label={`Remove from ${groupNames.get(groupId)}`} disabled={busy}
                      onClick={() => mutate("leave-group", () => supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", personId))}>×</button>
                  )}
                </span>
              ))}
              {initialGroupIds.length === 0 && <span className="chip-list__empty">Not in any training group</span>}
            </div>
            {canEdit && (
              <MultiPicker items={groupOptions} excludeIds={initialGroupIds} placeholder="Add to training groups…" noun="training group" busy={busy}
                onAdd={(ids) => mutate("join-groups", () => supabase.from("group_members").insert(ids.map((groupId) => ({ group_id: groupId, user_id: personId }))))} />
            )}
          </>
        )}

        <div className={showGroups ? "course-admin__subhead" : "course-admin__subhead course-admin__subhead--first"}>Courses</div>
        <div className="required-course-list">
          {required.map((course) => (
            <div className="required-course" key={course.id}>
              <span className={`required-course__mark ${course.passed ? "is-passed" : ""}`} aria-label={course.passed ? doneLabel(course) : "Not yet completed"}>{course.passed ? "✓" : ""}</span>
              <span className="required-course__name">
                <strong>{course.title}</strong>
                <small>
                  <span className="tp-mono">{course.code}</span>
                  {showGroups && course.reasons.length > 0 && ` · ${course.reasons.map((reason) => (reason.group_id ? groupNames.get(reason.group_id) : "Assigned individually")).join(", ")}`}
                </small>
              </span>
              <span className={course.passed ? "required-course__status is-passed" : "required-course__status"}>{course.passed ? doneLabel(course) : "Not done yet"}</span>
              {canEdit && directByCourse.has(course.id) && directControls(directByCourse.get(course.id), course)}
            </div>
          ))}
          {required.length === 0 && <span className="chip-list__empty">Nothing required yet.</span>}
        </div>

        {(optional.length > 0 || canEdit) && (
          <>
            <div className="course-admin__subhead">Optional courses</div>
            <div className="required-course-list">
              {optional.map((course) => (
                <div className="required-course" key={course.id}>
                  <span className={`required-course__mark ${course.passed ? "is-passed" : ""}`} aria-label={course.passed ? doneLabel(course) : "Not yet completed"}>{course.passed ? "✓" : ""}</span>
                  <span className="required-course__name">
                    <strong>{course.title}</strong>
                    <small>
                      <span className="tp-mono">{course.code}</span>
                      {showGroups && course.reasons.length > 0 && ` · ${course.reasons.map((reason) => (reason.group_id ? groupNames.get(reason.group_id) : "Given individually")).join(", ")}`}
                    </small>
                  </span>
                  <span className={course.passed ? "required-course__status is-passed" : "required-course__status"}>{course.passed ? doneLabel(course) : "Not taken"}</span>
                  {canEdit && directByCourse.has(course.id) && directControls(directByCourse.get(course.id), course)}
                </div>
              ))}
              {optional.length === 0 && <span className="chip-list__empty">No optional courses given to them.</span>}
            </div>
          </>
        )}

        {canEdit && (
          <>
            <p className="course-admin__hint required-training__hint">Give courses to this person on top of their training groups. {REQUIRED_HINT}</p>
            <AddAsSelect value={addAs} onChange={setAddAs} />
            <MultiPicker items={courseOptions} excludeIds={directCourseIds} placeholder="Give courses to this person…" addLabel="Add" noun="course" busy={busy}
              onAdd={(ids) => mutate("assign-courses", () => supabase.from("course_assignments").insert(ids.map((courseId) => ({ course_id: courseId, user_id: personId, required: addAs === "required" }))))} />
          </>
        )}
        <Notice tone="error" className="required-training__error">{error}</Notice>
      </div>
    </section>
  );
}
