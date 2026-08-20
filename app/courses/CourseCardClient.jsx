"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function CourseCardClient({ course, userId, initiallyEnrolled, readingComplete, history }) {
  const supabase = createClient();
  const [enrolled, setEnrolled] = useState(initiallyEnrolled);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState("");
  const lastPass = history.find((attempt) => attempt.passed);

  async function enroll() {
    setEnrolling(true);
    setError("");
    const { error: enrollmentError } = await supabase
      .from("reading_sessions")
      .insert({ user_id: userId, course_id: course.id });

    if (enrollmentError) setError(enrollmentError.message);
    else setEnrolled(true);
    setEnrolling(false);
  }

  return (
    <div className="tp-card course-card">
      <div className="course-card__content">
        <div className="course-card__meta">
          <span className="tp-mono" style={{ fontSize: 11, color: "var(--faint)" }}>{course.code}</span>
          {lastPass ? (
            <span className="tp-badge" style={{ background: "var(--success-dim)", color: "var(--success)" }}>Passed · {lastPass.score}%</span>
          ) : history.length ? (
            <span className="tp-badge" style={{ background: "var(--danger-dim)", color: "var(--danger)" }}>Not yet passed</span>
          ) : enrolled ? (
            <span className="tp-badge" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>Enrolled</span>
          ) : (
            <span className="tp-badge" style={{ background: "var(--surface3)", color: "var(--dim)" }}>Not enrolled</span>
          )}
        </div>
        <div className="tp-display course-card__title">{course.title}</div>
        <div className="course-card__description">{course.description}</div>

        {enrolled && (
          <div className="course-steps" aria-label="Course steps">
            <Link href={`/courses/${course.id}/read`} className="course-step">
              <span className="course-step__number">1</span>
              <span><strong>PDF reading</strong><small>{readingComplete ? "Completed" : "Read and answer checkpoints"}</small></span>
              <span aria-hidden="true">→</span>
            </Link>
            {readingComplete ? (
              <Link href={`/courses/${course.id}/quiz`} className="course-step">
                <span className="course-step__number">2</span>
                <span><strong>Assessment</strong><small>{lastPass ? "Passed" : history.length ? "Retake available" : "Ready to begin"}</small></span>
                <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <div className="course-step is-locked" aria-disabled="true">
                <span className="course-step__number">2</span>
                <span><strong>Assessment</strong><small>Complete the reading first</small></span>
                <span aria-hidden="true">🔒</span>
              </div>
            )}
          </div>
        )}
        {error && <div style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 10 }}>{error}</div>}
      </div>

      {!enrolled && (
        <button className="tp-btn tp-btn-primary course-card__action" disabled={enrolling} onClick={enroll}>
          {enrolling ? "Enrolling…" : "Enroll"}
        </button>
      )}
    </div>
  );
}
