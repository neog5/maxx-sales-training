import TopNav from "@/components/TopNav";
import { requireViewer } from "@/lib/auth";
import { passedCoursesByUser } from "@/lib/compliance";
import { must } from "@/lib/db";
import { firstName } from "@/lib/people";
import CourseCardClient from "./CourseCardClient";

// Map<courseId, rows> for rows that carry a course_id.
function groupByCourse(rows) {
  const grouped = new Map();
  for (const row of rows) grouped.set(row.course_id, [...(grouped.get(row.course_id) || []), row]);
  return grouped;
}

export default async function CoursesPage() {
  const { supabase, user, profile } = await requireViewer();
  const rows = async (query, what) => must(await query, what) || [];
  const [courses, attempts, readingSessions, requiredRows, certificates] = await Promise.all([
    rows(supabase.from("courses").select("id, code, title, description, view_only").eq("is_active", true).is("archived_at", null).order("code"), "courses"),
    // Newest first, so the first passed attempt in a course's history is the latest pass.
    rows(
      supabase
        .from("quiz_attempts")
        .select("id, user_id, course_id, score, passed")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("submitted_at", { ascending: false }),
      "your attempts"
    ),
    rows(supabase.from("reading_sessions").select("course_id, checkpoint_passed").eq("user_id", user.id), "your reading progress"),
    // Managers and admins can read everyone's rows, so filter to this person.
    rows(supabase.rpc("required_courses").eq("user_id", user.id), "your required courses"),
    rows(supabase.from("certificates").select("id, user_id, course_id").eq("user_id", user.id), "your certificates"),
  ]);

  const certificateIdByCourse = new Map(certificates.map((certificate) => [certificate.course_id, certificate.id]));
  const attemptsByCourse = groupByCourse(attempts);
  const sessionsByCourse = groupByCourse(readingSessions);
  const requiredIds = new Set(requiredRows.map((row) => row.course_id));
  const requiredCourses = courses.filter((course) => requiredIds.has(course.id));
  const otherCourses = courses.filter((course) => !requiredIds.has(course.id));
  const passedCourseIds = passedCoursesByUser(attempts, certificates).get(user.id) || new Set();
  const requiredPassed = requiredCourses.filter((course) => passedCourseIds.has(course.id)).length;
  const readingsDone = new Set(readingSessions.filter((session) => session.checkpoint_passed).map((session) => session.course_id)).size;

  function renderCourses(list, offset = 0) {
    return list.map((course, index) => {
      const sessions = sessionsByCourse.get(course.id) || [];
      return (
        <CourseCardClient
          key={course.id}
          course={course}
          initiallyEnrolled={sessions.length > 0}
          readingComplete={sessions.some((session) => session.checkpoint_passed)}
          history={attemptsByCourse.get(course.id) || []}
          certificateId={certificateIdByCourse.get(course.id)}
          index={index + offset}
        />
      );
    });
  }

  return (
    <div>
      <TopNav profile={profile} />
      <main className="tp-page courses-page tp-fade-in">
        <section className="courses-hero">
          <div className="courses-hero__copy">
            <div className="tp-label">Learning hub</div>
            <h1 className="tp-display">Welcome back, {firstName(profile.full_name)}.</h1>
            <p>Build product confidence at your pace. Read the material, complete the checkpoints, and pass each assessment.</p>
          </div>
          <div className="courses-hero__summary" aria-label="Training summary">
            <div><strong className="tp-display">{requiredCourses.length}</strong><span>Required</span></div>
            <div><strong className="tp-display">{readingsDone}</strong><span>Readings done</span></div>
            <div><strong className="tp-display">{passedCourseIds.size}</strong><span>Completed</span></div>
          </div>
        </section>

        <div className="section-heading">
          <div>
            <div className="tp-label">Assigned training</div>
            <h2 className="tp-display">Required courses</h2>
          </div>
          <span>{requiredPassed} of {requiredCourses.length} complete</span>
        </div>

        <div className="course-list">
          {renderCourses(requiredCourses)}
          {requiredCourses.length === 0 && <div className="tp-card courses-empty">No courses have been assigned to you yet.</div>}
        </div>

        {otherCourses.length > 0 && (
          <>
            <div className="section-heading section-heading--spaced">
              <div>
                <div className="tp-label">Optional</div>
                <h2 className="tp-display">Other available courses</h2>
              </div>
              <span>Not required for your compliance</span>
            </div>
            <div className="course-list">{renderCourses(otherCourses, requiredCourses.length)}</div>
          </>
        )}

        {courses.length === 0 && <div className="tp-card courses-empty courses-empty--spaced">No courses are available yet.</div>}
      </main>
    </div>
  );
}
