import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import CourseCardClient from "./CourseCardClient";
import { fetchAssignmentsForUser } from "@/lib/assignments";

export default async function CoursesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: courses }, { data: attempts }, { data: readingSessions }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("courses").select("*").eq("is_active", true).is("archived_at", null).order("code"),
    supabase
      .from("quiz_attempts")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("submitted_at", { ascending: false }),
    supabase
      .from("reading_sessions")
      .select("course_id, checkpoint_passed")
      .eq("user_id", user.id),
    supabase.from("group_members").select("group_id").eq("user_id", user.id),
  ]);

  const groupIds = (memberships || []).map((membership) => membership.group_id);
  const assignments = await fetchAssignmentsForUser(supabase, user.id, groupIds, "course_id");
  const requiredIds = new Set(assignments.map((assignment) => assignment.course_id));

  const byCourse = {};
  (attempts || []).forEach((a) => { (byCourse[a.course_id] = byCourse[a.course_id] || []).push(a); });
  const activeCourses = courses || [];
  const requiredCourses = activeCourses.filter((course) => requiredIds.has(course.id));
  const otherCourses = activeCourses.filter((course) => !requiredIds.has(course.id));
  const passedCourseIds = new Set((attempts || []).filter((attempt) => attempt.passed).map((attempt) => attempt.course_id));
  const requiredPassed = requiredCourses.filter((course) => passedCourseIds.has(course.id)).length;
  const readingCompleteIds = new Set((readingSessions || []).filter((session) => session.checkpoint_passed).map((session) => session.course_id));
  const firstName = profile?.full_name?.trim()?.split(/\s+/)[0] || "there";

  function renderCourses(list, offset = 0) {
    return list.map((c, index) => {
      const courseSessions = (readingSessions || []).filter((session) => session.course_id === c.id);
      return (
        <CourseCardClient
          key={c.id}
          course={c}
          userId={user.id}
          initiallyEnrolled={courseSessions.length > 0}
          readingComplete={courseSessions.some((session) => session.checkpoint_passed)}
          history={byCourse[c.id] || []}
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
            <h1 className="tp-display">Welcome back, {firstName}.</h1>
            <p>Build product confidence at your pace. Read the material, complete the checkpoints, and pass each assessment.</p>
          </div>
          <div className="courses-hero__summary" aria-label="Training summary">
            <div><strong className="tp-display">{requiredCourses.length}</strong><span>Required</span></div>
            <div><strong className="tp-display">{readingCompleteIds.size}</strong><span>Readings done</span></div>
            <div><strong className="tp-display">{passedCourseIds.size}</strong><span>Passed</span></div>
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
          {requiredCourses.length === 0 && (
            <div className="tp-card" style={{ padding: 24, color: "var(--faint)", fontSize: 13.5 }}>
              No courses have been assigned to you yet.
            </div>
          )}
        </div>

        {otherCourses.length > 0 && (
          <>
            <div className="section-heading" style={{ marginTop: 40 }}>
              <div>
                <div className="tp-label">Optional</div>
                <h2 className="tp-display">Other available courses</h2>
              </div>
              <span>Not required for your compliance</span>
            </div>
            <div className="course-list">{renderCourses(otherCourses, requiredCourses.length)}</div>
          </>
        )}

        {activeCourses.length === 0 && (
          <div className="tp-card" style={{ padding: 24, marginTop: 16, color: "var(--faint)", fontSize: 13.5 }}>
            No courses yet — an admin needs to add one, or run <span className="tp-mono">supabase/seed.sql</span>.
          </div>
        )}
      </main>
    </div>
  );
}
