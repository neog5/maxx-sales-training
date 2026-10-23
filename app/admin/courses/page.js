import Link from "next/link";
import TopNav from "@/components/TopNav";
import { requireViewer } from "@/lib/auth";
import { isAdmin } from "@/lib/roles.mjs";
import { formatDate } from "@/lib/format.mjs";
import AdminTabs from "../AdminTabs";

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows || []) counts.set(row[key], (counts.get(row[key]) || 0) + 1);
  return counts;
}

export default async function CoursesAdminPage() {
  const { supabase, profile } = await requireViewer(isAdmin);

  const [{ data: courses }, { data: attempts }, { data: questions }, { data: assignments }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, code, title, is_active, created_at, archived_at, archiver:profiles!courses_archived_by_fkey(full_name)")
      .order("code"),
    supabase.from("quiz_attempts").select("course_id").eq("status", "completed"),
    supabase.from("questions").select("course_id"),
    supabase.from("course_assignments").select("course_id"),
  ]);

  const attemptCounts = countBy(attempts, "course_id");
  const questionCounts = countBy(questions, "course_id");
  const assignmentCounts = countBy(assignments, "course_id");
  const current = (courses || []).filter((course) => !course.archived_at);
  const archived = (courses || []).filter((course) => course.archived_at);

  function CourseRows({ rows, empty }) {
    return (
      <div className="tp-card course-admin-table">
        <div className="course-admin-table__head">
          <div>Course</div><div>Status</div><div>Questions</div><div>Assigned to</div><div>Attempts</div><div></div>
        </div>
        {rows.map((course) => (
          <div className="course-admin-table__row" key={course.id}>
            <div>
              <Link className="profile-link" href={`/admin/courses/${course.id}`}>{course.title}</Link>
              <small className="tp-mono">{course.code}</small>
            </div>
            <div>
              {course.archived_at ? (
                <span className="course-status course-status--archived" title={`Archived ${formatDate(course.archived_at)}${course.archiver?.full_name ? ` by ${course.archiver.full_name}` : ""}`}>
                  Archived {formatDate(course.archived_at)}
                  {course.archiver?.full_name && <small>by {course.archiver.full_name}</small>}
                </span>
              ) : course.is_active ? (
                <span className="course-status course-status--live">Live</span>
              ) : (
                <span className="course-status course-status--hidden">Hidden</span>
              )}
            </div>
            <div className="tp-mono">{questionCounts.get(course.id) || 0}</div>
            <div className="tp-mono">{assignmentCounts.get(course.id) || 0}</div>
            <div className="tp-mono">{attemptCounts.get(course.id) || 0}</div>
            <div><Link href={`/admin/courses/${course.id}`} className="tp-btn tp-btn-ghost people-view-link">Manage</Link></div>
          </div>
        ))}
        {rows.length === 0 && <div className="admin-insight-empty">{empty}</div>}
      </div>
    );
  }

  return (
    <div>
      <TopNav profile={profile} />
      <div className="admin-nav tp-fade-in">
        <AdminTabs active="courses" role={profile.role} />
      </div>
      <main className="tp-page tp-fade-in">
        <div className="page-heading section-heading-row">
          <div>
            <div className="tp-label">Admin workspace</div>
            <h1 className="tp-display">Courses</h1>
            <p>Manage course details, who must complete each course, and archive courses you no longer use. Archived courses keep every training record.</p>
          </div>
          <Link href="/admin/courses/new" className="tp-btn tp-btn-primary">+ Add course</Link>
        </div>

        <section className="profile-report-section">
          <div className="section-heading-row"><div><div className="tp-label">Current courses</div><span>{current.length} {current.length === 1 ? "course" : "courses"}</span></div></div>
          <CourseRows rows={current} empty="No current courses. Add one to get started." />
        </section>

        <section className="profile-report-section">
          <div className="section-heading-row"><div><div className="tp-label">Archived courses</div><span>Hidden from learners, kept for compliance records</span></div></div>
          <CourseRows rows={archived} empty="No archived courses." />
        </section>
      </main>
    </div>
  );
}
