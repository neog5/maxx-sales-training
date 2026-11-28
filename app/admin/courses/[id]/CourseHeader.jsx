import Link from "next/link";
import LocalDate from "@/components/LocalDate";
import { routes } from "@/lib/routes";

// Shared heading and sub-tabs for a course's Overview and Questions pages: the title with its
// code beside it, and on the right the number of training records plus `actions` (Archive /
// Delete, Overview tab only).
export default function CourseHeader({ course, active, questionCount, recordCount, actions = null }) {
  const archived = Boolean(course.archived_at);
  return (
    <>
      <Link href={routes.adminCourses} className="tp-btn tp-btn-ghost back-link">← All courses</Link>
      <div className="page-heading course-heading">
        <div className="course-heading__text">
          <div className="course-heading__title">
            <h1 className="tp-display">{course.title}</h1>
            <span className="tp-mono course-heading__code" title="Course code">{course.code}</span>
          </div>
          {archived && (
            <p className="course-heading__archived">
              Archived <LocalDate value={course.archived_at} />{course.archiver?.full_name ? ` by ${course.archiver.full_name}` : ""}. Learners can’t start it and it doesn’t count toward compliance.
            </p>
          )}
        </div>
        <div className="course-heading__side">
          <p>{recordCount} training {recordCount === 1 ? "record" : "records"}</p>
          {actions}
        </div>
      </div>
      <nav className="course-tabs" aria-label="Course sections">
        <Link href={routes.adminCourse(course.id)} aria-current={active === "overview" ? "page" : undefined}>Overview</Link>
        <Link href={routes.adminCourseQuestions(course.id)} aria-current={active === "questions" ? "page" : undefined}>
          Questions<small>{questionCount}</small>
        </Link>
      </nav>
    </>
  );
}
