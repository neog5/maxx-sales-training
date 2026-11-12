import Link from "next/link";
import LocalDate from "@/components/LocalDate";
import { requireViewer } from "@/lib/auth";
import { fetchAll, must } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { routes } from "@/lib/routes";
import AdminPage from "../AdminPage";

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) || 0) + 1);
  return counts;
}

// Every row of a table's course_id column, to count per course.
function fetchCourseIds(supabase, table, what, filter = (query) => query) {
  return fetchAll(() => filter(supabase.from(table).select("course_id")).order("id"), what);
}

function CourseStatus({ course }) {
  if (course.archived_at) {
    return (
      <span className="course-status course-status--archived">
        <span>Archived <LocalDate value={course.archived_at} /></span>
        {course.archiver?.full_name && <small>by {course.archiver.full_name}</small>}
      </span>
    );
  }
  return course.is_active
    ? <span className="course-status course-status--live">Live</span>
    : <span className="course-status course-status--hidden">Hidden</span>;
}

function CourseRows({ rows, counts, empty }) {
  return (
    <div className="tp-card course-admin-table">
      <div className="course-admin-table__head">
        <div>Course</div><div>Status</div><div>Questions</div><div>Assigned to</div><div>Attempts</div><div></div>
      </div>
      {rows.map((course) => (
        <div className="course-admin-table__row" key={course.id}>
          <div>
            <Link className="profile-link" href={routes.adminCourse(course.id)}>{course.title}</Link>
            <small className="tp-mono">{course.code}</small>
          </div>
          <div><CourseStatus course={course} /></div>
          <div className="tp-mono">{course.view_only ? <small>Reading only</small> : counts.questions.get(course.id) || 0}</div>
          <div className="tp-mono">{counts.assignments.get(course.id) || 0}</div>
          <div className="tp-mono">{counts.attempts.get(course.id) || 0}</div>
          <div><Link href={routes.adminCourse(course.id)} className="tp-btn tp-btn-ghost people-view-link">Manage</Link></div>
        </div>
      ))}
      {rows.length === 0 && <div className="admin-insight-empty">{empty}</div>}
    </div>
  );
}

export default async function CoursesAdminPage() {
  const { supabase, profile } = await requireViewer(isAdmin);

  const [courses, attempts, questions, assignments] = await Promise.all([
    supabase
      .from("courses")
      .select("id, code, title, is_active, view_only, created_at, archived_at, archiver:profiles!courses_archived_by_fkey(full_name)")
      .order("code")
      .then((result) => must(result, "courses")),
    fetchCourseIds(supabase, "quiz_attempts", "completed attempts", (query) => query.eq("status", "completed")),
    fetchCourseIds(supabase, "questions", "questions"),
    fetchCourseIds(supabase, "course_assignments", "course assignments"),
  ]);

  const counts = {
    attempts: countBy(attempts, "course_id"),
    questions: countBy(questions, "course_id"),
    assignments: countBy(assignments, "course_id"),
  };
  const current = courses.filter((course) => !course.archived_at);
  const archived = courses.filter((course) => course.archived_at);

  return (
    <AdminPage profile={profile}>
      <main className="tp-page tp-fade-in">
        <div className="page-heading section-heading-row">
          <div>
            <h1 className="tp-display">Courses</h1>
          </div>
          <Link href={routes.newCourse} className="tp-btn tp-btn-primary">+ Add course</Link>
        </div>

        <section className="profile-report-section">
          <div className="section-heading-row"><div><div className="tp-label">Current courses</div><span>{current.length} {current.length === 1 ? "course" : "courses"}</span></div></div>
          <CourseRows rows={current} counts={counts} empty="No current courses. Add one to get started." />
        </section>

        <section className="profile-report-section">
          <div className="section-heading-row"><div><div className="tp-label">Archived courses</div><span>Hidden from learners</span></div></div>
          <CourseRows rows={archived} counts={counts} empty="No archived courses." />
        </section>
      </main>
    </AdminPage>
  );
}
