"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import MultiPicker from "@/components/MultiPicker";
import { createClient } from "@/lib/supabase/client";
import { courseItems, groupItems } from "@/lib/picker-items.mjs";

// Lists the courses this person must complete. `requiredCourseIds` comes from the
// database's required_courses(). Group membership and the reason for each course are
// shown only to admins and to the person themself (`showGroups`); admins can edit them.
export default function RequiredTraining({ personId, canEdit, showGroups, groups, initialGroupIds, courses, requiredCourseIds, initialAssignments, passedCourseIds }) {
  const supabase = createClient();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = saving || refreshing;

  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const passed = new Set(passedCourseIds);
  const memberGroupIds = new Set(initialGroupIds);
  const requiredIds = new Set(requiredCourseIds);
  const reasonsFor = (courseId) => initialAssignments.filter((assignment) => assignment.course_id === courseId
    && (assignment.user_id === personId || memberGroupIds.has(assignment.group_id)));
  const required = courses
    .filter((course) => requiredIds.has(course.id))
    .map((course) => ({ ...course, reasons: reasonsFor(course.id), passed: passed.has(course.id) }));
  const completed = required.filter((course) => course.passed).length;
  const directCourseIds = initialAssignments.filter((assignment) => assignment.user_id === personId).map((assignment) => assignment.course_id);
  const groupOptions = useMemo(() => groupItems(groups), [groups]);
  const courseOptions = useMemo(() => courseItems(courses), [courses]);

  async function mutate(action) {
    setSaving(true);
    setError("");
    const { error: mutationError } = await action();
    setSaving(false);
    if (mutationError) {
      setError(mutationError.message || "Something went wrong. Please try again.");
      return false;
    }
    startRefresh(() => router.refresh());
    return true;
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
        {showGroups && (
          <>
            <div className="course-admin__subhead" style={{ marginTop: 0 }}>Training groups</div>
            <div className="chip-list">
              {initialGroupIds.map((groupId) => (
                <span className="chip" key={groupId}>
                  {canEdit ? <Link href={`/admin/training-groups?group=${groupId}`}>{groupNames.get(groupId)}</Link> : groupNames.get(groupId)}
                  {canEdit && (
                    <button type="button" aria-label={`Remove from ${groupNames.get(groupId)}`} disabled={busy}
                      onClick={() => mutate(() => supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", personId))}>×</button>
                  )}
                </span>
              ))}
              {initialGroupIds.length === 0 && <span className="chip-list__empty">Not in any training group</span>}
            </div>
            {canEdit && (
              <MultiPicker items={groupOptions} excludeIds={initialGroupIds} placeholder="Add to training groups…" noun="training group" busy={busy}
                onAdd={(ids) => mutate(() => supabase.from("group_members").insert(ids.map((groupId) => ({ group_id: groupId, user_id: personId }))))} />
            )}
          </>
        )}

        <div className="course-admin__subhead" style={showGroups ? undefined : { marginTop: 0 }}>Courses</div>
        <div className="required-course-list">
          {required.map((course) => (
            <div className="required-course" key={course.id}>
              <span className={`required-course__mark ${course.passed ? "is-passed" : ""}`} aria-label={course.passed ? "Passed" : "Not yet passed"}>{course.passed ? "✓" : ""}</span>
              <span className="required-course__name">
                <strong>{course.title}</strong>
                <small>
                  <span className="tp-mono">{course.code}</span>
                  {showGroups && course.reasons.length > 0 && ` · ${course.reasons.map((reason) => (reason.group_id ? groupNames.get(reason.group_id) : "Assigned individually")).join(", ")}`}
                </small>
              </span>
              <span className={course.passed ? "required-course__status is-passed" : "required-course__status"}>{course.passed ? "Passed" : "Outstanding"}</span>
              {canEdit && directCourseIds.includes(course.id) && (
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
          <MultiPicker items={courseOptions} excludeIds={directCourseIds} placeholder="Assign extra courses to this person…" addLabel="Assign" noun="course" busy={busy}
            onAdd={(ids) => mutate(() => supabase.from("course_assignments").insert(ids.map((courseId) => ({ course_id: courseId, user_id: personId }))))} />
        )}
        {error && <div className="notice notice--error" role="alert" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>}
      </div>
    </section>
  );
}
