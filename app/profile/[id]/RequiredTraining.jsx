"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const directCourseIds = initialAssignments.filter((assignment) => assignment.user_id === personId).map((assignment) => assignment.course_id);
  const groupOptions = useMemo(() => groupItems(groups), [groups]);
  const courseOptions = useMemo(() => courseItems(courses), [courses]);

  // Saves, then re-reads the page's server data; stays busy until that refresh lands.
  async function mutate(label, action) {
    const saved = await run(label, action);
    if (saved) startRefresh(() => router.refresh());
    return Boolean(saved);
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
              {canEdit && directCourseIds.includes(course.id) && (
                <button type="button" className="tp-btn tp-btn-ghost required-course__remove" disabled={busy}
                  onClick={() => mutate("unassign-course", () => supabase.from("course_assignments").delete().eq("course_id", course.id).eq("user_id", personId))}>
                  Remove individual assignment
                </button>
              )}
            </div>
          ))}
          {required.length === 0 && <span className="chip-list__empty">Nothing assigned yet.</span>}
        </div>
        {canEdit && (
          <MultiPicker items={courseOptions} excludeIds={directCourseIds} placeholder="Assign extra courses to this person…" addLabel="Assign" noun="course" busy={busy}
            onAdd={(ids) => mutate("assign-courses", () => supabase.from("course_assignments").insert(ids.map((courseId) => ({ course_id: courseId, user_id: personId }))))} />
        )}
        <Notice tone="error" className="required-training__error">{error}</Notice>
      </div>
    </section>
  );
}
