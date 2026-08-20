import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import CourseCardClient from "./CourseCardClient";

export default async function CoursesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const { data: courses } = await supabase.from("courses").select("*").eq("is_active", true).order("code");
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("submitted_at", { ascending: false });
  const { data: readingSessions } = await supabase
    .from("reading_sessions")
    .select("course_id, checkpoint_passed")
    .eq("user_id", user.id);

  const byCourse = {};
  (attempts || []).forEach((a) => { (byCourse[a.course_id] = byCourse[a.course_id] || []).push(a); });
  const activeCourses = courses || [];
  const passedCourseIds = new Set((attempts || []).filter((attempt) => attempt.passed).map((attempt) => attempt.course_id));
  const readingCompleteIds = new Set((readingSessions || []).filter((session) => session.checkpoint_passed).map((session) => session.course_id));
  const firstName = profile?.full_name?.trim()?.split(/\s+/)[0] || "there";

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
            <div><strong className="tp-display">{activeCourses.length}</strong><span>Courses</span></div>
            <div><strong className="tp-display">{readingCompleteIds.size}</strong><span>Readings done</span></div>
            <div><strong className="tp-display">{passedCourseIds.size}</strong><span>Passed</span></div>
          </div>
        </section>

        <div className="section-heading">
          <div>
            <div className="tp-label">Assigned training</div>
            <h2 className="tp-display">Your courses</h2>
          </div>
          <span>{passedCourseIds.size} of {activeCourses.length} complete</span>
        </div>

        <div className="course-list">
          {activeCourses.map((c, index) => {
            const hist = byCourse[c.id] || [];
            const courseSessions = (readingSessions || []).filter((session) => session.course_id === c.id);
            return (
              <CourseCardClient
                key={c.id}
                course={c}
                userId={user.id}
                initiallyEnrolled={courseSessions.length > 0}
                readingComplete={courseSessions.some((session) => session.checkpoint_passed)}
                history={hist}
                index={index}
              />
            );
          })}
          {(!courses || courses.length === 0) && (
            <div className="tp-card" style={{ padding: 24, color: "var(--faint)", fontSize: 13.5 }}>
              No courses yet — an admin needs to add one, or run <span className="tp-mono">supabase/seed.sql</span>.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
