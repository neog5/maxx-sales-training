"use client";

import { useState } from "react";
import Link from "next/link";
import Notice from "@/components/Notice";
import StatusBadge from "@/components/StatusBadge";
import { startReading } from "@/lib/queries";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

function CourseBadge({ viewOnly, complete, lastPass, attempted, enrolled }) {
  if (viewOnly && complete) return <StatusBadge tone="success">Completed</StatusBadge>;
  if (lastPass) return <StatusBadge tone="success">Passed · {lastPass.score}%</StatusBadge>;
  if (attempted) return <StatusBadge tone="danger">Not yet passed</StatusBadge>;
  if (enrolled) return <StatusBadge tone="accent">Enrolled</StatusBadge>;
  return <StatusBadge>Not enrolled</StatusBadge>;
}

function StepLink({ href, number, title, detail }) {
  return (
    <Link href={href} className="course-step">
      <span className="course-step__number">{number}</span>
      <span><strong>{title}</strong><small>{detail}</small></span>
      <span className="course-step__arrow" aria-hidden="true">→</span>
    </Link>
  );
}

function LockedStep({ number, title, detail }) {
  return (
    <div className="course-step is-locked" aria-disabled="true">
      <span className="course-step__number">{number}</span>
      <span><strong>{title}</strong><small>{detail}</small></span>
      <span className="course-step__lock" aria-hidden="true">Locked</span>
    </div>
  );
}

// `history` is this person's completed attempts on the course, newest first.
export default function CourseCardClient({ course, initiallyEnrolled, readingComplete, history, certificateId, index }) {
  const [enrolled, setEnrolled] = useState(initiallyEnrolled);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState("");
  const viewOnly = course.view_only;
  const lastPass = history.find((attempt) => attempt.passed);
  // A reading-only course has no test: reading it issues the certificate.
  const complete = viewOnly ? Boolean(certificateId) : Boolean(lastPass);
  const attempted = history.length > 0 && !viewOnly;
  const progress = complete ? 100 : readingComplete ? 66 : enrolled ? 24 : 0;

  async function enroll() {
    setEnrolling(true);
    setError("");
    try {
      await startReading(createClient(), course.id);
      setEnrolled(true);
    } catch (cause) {
      setError(cause.message);
    }
    setEnrolling(false);
  }

  return (
    <article className={complete ? "tp-card course-card course-card--passed" : "tp-card course-card"}>
      <div className="course-card__visual" aria-hidden="true">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <svg viewBox="0 0 24 24"><path d="M5 4.75A2.75 2.75 0 0 1 7.75 2H20v16H7.75A2.75 2.75 0 0 0 5 20.75v-16Z"/><path d="M5 20.75A2.75 2.75 0 0 1 7.75 18H20v4H7.75A2.75 2.75 0 0 1 5 19.25V4.75"/></svg>
      </div>
      <div className="course-card__content">
        <div className="course-card__meta">
          <span className="course-card__code">{course.code}</span>
          <CourseBadge viewOnly={viewOnly} complete={complete} lastPass={lastPass} attempted={attempted} enrolled={enrolled} />
        </div>
        <div className="tp-display course-card__title">{course.title}</div>
        <div className="course-card__description">{course.description}</div>

        <div className="course-progress" aria-label={`${progress}% course progress`}>
          <div className="course-progress__track"><span style={{ width: `${progress}%` }} /></div>
          <span>{progress}%</span>
        </div>

        {enrolled && (
          <div className="course-steps" aria-label="Course steps">
            <StepLink
              href={routes.read(course.id)}
              number={1}
              title="PDF reading"
              detail={readingComplete ? "Completed" : viewOnly ? "Read the course material" : "Read and answer checkpoints"}
            />
            {viewOnly ? (
              !certificateId && <LockedStep number={2} title="Certificate" detail="Issued when you finish the reading" />
            ) : readingComplete ? (
              <StepLink href={routes.quiz(course.id)} number={2} title="Assessment" detail={lastPass ? "Passed" : history.length ? "Retake available" : "Ready to begin"} />
            ) : (
              <LockedStep number={2} title="Assessment" detail="Complete the reading first" />
            )}
            {certificateId && <StepLink href={routes.certificate(certificateId)} number={viewOnly ? 2 : 3} title="Certificate" detail="View and download" />}
          </div>
        )}
        <Notice tone="error" className="course-card__error">{error}</Notice>
      </div>

      {!enrolled && (
        <button type="button" className="tp-btn tp-btn-primary course-card__action" disabled={enrolling} onClick={enroll}>
          {enrolling ? "Enrolling…" : "Start course"}
        </button>
      )}
    </article>
  );
}
