import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { routes } from "@/lib/routes";

function CourseBadge({ complete, attempted, enrolled }) {
  if (complete) return <StatusBadge tone="success">Completed</StatusBadge>;
  if (attempted) return <StatusBadge tone="danger">Not passed yet</StatusBadge>;
  if (enrolled) return <StatusBadge tone="accent">In progress</StatusBadge>;
  return <StatusBadge>Not started</StatusBadge>;
}

// One row of the course checklist: done (tick), next (number, highlighted) or later (number).
function Step({ number, title, state }) {
  return (
    <li className={`course-step is-${state}`}>
      <span className="course-step__mark" aria-hidden="true">{state === "done" ? "✓" : number}</span>
      <span className="course-step__title">{title}</span>
      <span className="tp-sr-only">{state === "done" ? "done" : state === "next" ? "next step" : "not yet"}</span>
    </li>
  );
}

// The one thing to do next on this course, as a button.
function nextAction({ course, enrolled, readingComplete, complete, attempted, certificateId }) {
  if (complete) return certificateId ? { href: routes.certificate(certificateId), label: "View certificate" } : null;
  if (!enrolled) return { href: routes.read(course.id), label: "Start course" };
  if (!course.view_only && readingComplete) return { href: routes.quiz(course.id), label: attempted ? "Retake assessment" : "Take assessment" };
  return { href: routes.read(course.id), label: "Continue reading" };
}

// A course tile on the courses page. `history` is this person's completed attempts, newest first.
export default function CourseCard({ course, enrolled, readingComplete, history, certificateId }) {
  const viewOnly = course.view_only;
  const lastPass = history.find((attempt) => attempt.passed);
  // A reading-only course has no test: reading it issues the certificate.
  const complete = viewOnly ? Boolean(certificateId) : Boolean(lastPass);
  const attempted = history.length > 0 && !viewOnly && !complete;
  const readingDone = readingComplete || complete;
  const action = nextAction({ course, enrolled, readingComplete: readingDone, complete, attempted, certificateId });

  const steps = viewOnly
    ? [{ title: "Read the course", done: readingDone }]
    : [
      { title: "Read the course", done: readingDone },
      { title: lastPass ? `Pass the assessment · ${lastPass.score}%` : "Pass the assessment", done: complete },
    ];
  const nextIndex = steps.findIndex((step) => !step.done);

  return (
    <article className={complete ? "tp-card course-card course-card--passed" : "tp-card course-card"}>
      {complete && <span className="course-card__tick" aria-hidden="true">✓</span>}
      <div className="course-card__meta">
        <span className="course-card__code">{course.code}</span>
        <CourseBadge complete={complete} attempted={attempted} enrolled={enrolled} />
      </div>
      <h3 className="tp-display course-card__title">{course.title}</h3>
      {course.description && <p className="course-card__description">{course.description}</p>}

      <ol className="course-steps" aria-label="Course steps">
        {steps.map((step, index) => (
          <Step key={step.title} number={index + 1} title={step.title} state={step.done ? "done" : index === nextIndex ? "next" : "later"} />
        ))}
        <Step number={steps.length + 1} title="Get your certificate" state={certificateId ? "done" : "later"} />
      </ol>

      <div className="course-card__actions">
        {action && (
          <Link href={action.href} className={`tp-btn ${complete ? "tp-btn-ghost" : "tp-btn-primary"} course-card__action`}>
            {action.label} <span aria-hidden="true">→</span>
          </Link>
        )}
        {complete && <Link href={routes.read(course.id)} className="course-card__reread">Read again</Link>}
      </div>
    </article>
  );
}
