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

  return (
    <div>
      <TopNav profile={profile} />
      <main className="tp-page tp-page-narrow tp-fade-in">
        <div className="page-heading">
          <div className="tp-label">Assigned training</div>
          <h1 className="tp-display">Your courses</h1>
          <p>
          Complete the reading, then pass the assessment. Questions are drawn fresh from the bank each attempt.
          </p>
        </div>

        <div className="course-list">
          {(courses || []).map((c) => {
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
