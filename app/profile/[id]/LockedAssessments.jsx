"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MAX_ATTEMPTS } from "@/lib/attempts.mjs";

// Courses where this person has used all their attempts. Admins can approve a fresh set.
export default function LockedAssessments({ personId, courses, canApprove, viewerId }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");

  async function approve(course) {
    setBusyId(course.id);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.from("attempt_unlocks").insert({ user_id: personId, course_id: course.id, granted_by: viewerId });
    if (error) {
      setMessage(`Could not approve more attempts: ${error.message}`);
    } else {
      setMessage(`Approved ${MAX_ATTEMPTS} more attempts for ${course.code}.`);
      router.refresh();
    }
    setBusyId(null);
  }

  if (!courses.length && !message) return null;

  return (
    <section className="profile-report-section">
      <div className="section-heading-row">
        <div>
          <div className="tp-label">Locked assessments</div>
          <span>Used all {MAX_ATTEMPTS} attempts without passing{canApprove ? " — approve to give another " + MAX_ATTEMPTS : " — an admin must approve more attempts"}</span>
        </div>
      </div>
      <div className="tp-card certificate-list">
        {courses.map((course) => (
          <div key={course.id} className="certificate-list__row">
            <div>
              <strong>{course.title}</strong>
              <small>{course.code} · {course.failed} failed attempts</small>
            </div>
            {canApprove && (
              <button type="button" className="tp-btn tp-btn-primary" disabled={busyId === course.id} onClick={() => approve(course)}>
                {busyId === course.id ? "Approving…" : `Allow ${MAX_ATTEMPTS} more attempts`}
              </button>
            )}
          </div>
        ))}
        {!courses.length && <div className="admin-insight-empty">No locked assessments.</div>}
      </div>
      {message && <div className="role-editor__status" role="status">{message}</div>}
    </section>
  );
}
