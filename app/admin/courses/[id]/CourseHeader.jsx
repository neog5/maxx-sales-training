import Link from "next/link";
import { formatDate } from "@/lib/format.mjs";

// Shared heading and sub-tabs for a course's Overview and Questions pages.
export default function CourseHeader({ course, active, questionCount, recordCount }) {
  const archived = Boolean(course.archived_at);
  return (
    <>
      <Link href="/admin/courses" className="tp-btn tp-btn-ghost back-link">← All courses</Link>
      <div className="page-heading">
        <div className="tp-label tp-mono">{course.code}</div>
        <h1 className="tp-display">{course.title}</h1>
        <p>
          {archived
            ? `Archived ${formatDate(course.archived_at)}${course.archiver?.full_name ? ` by ${course.archiver.full_name}` : ""}. Learners can no longer start it, and it no longer counts toward compliance.`
            : `${recordCount} training ${recordCount === 1 ? "record" : "records"} (reading sessions and assessment attempts).`}
        </p>
      </div>
      <nav className="course-tabs" aria-label="Course sections">
        <Link href={`/admin/courses/${course.id}`} aria-current={active === "overview" ? "page" : undefined}>Overview</Link>
        <Link href={`/admin/courses/${course.id}/questions`} aria-current={active === "questions" ? "page" : undefined}>
          Questions<small>{questionCount}</small>
        </Link>
      </nav>
    </>
  );
}
