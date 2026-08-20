import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";

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
            const lastPass = hist.find((h) => h.passed);
            return (
              <div key={c.id} className="tp-card course-card">
                <div>
                  <div className="course-card__meta">
                    <span className="tp-mono" style={{ fontSize: 11, color: "var(--faint)" }}>{c.code}</span>
                    {lastPass ? (
                      <span className="tp-badge" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>Passed · {lastPass.score}%</span>
                    ) : hist.length ? (
                      <span className="tp-badge" style={{ background: "var(--danger-dim)", color: "var(--danger)" }}>Not yet passed</span>
                    ) : (
                      <span className="tp-badge" style={{ background: "var(--surface3)", color: "var(--dim)" }}>Not started</span>
                    )}
                  </div>
                  <div className="tp-display course-card__title">{c.title}</div>
                  <div className="course-card__description">{c.description}</div>
                </div>
                <Link href={`/courses/${c.id}/read`} className="tp-btn tp-btn-primary course-card__action">
                  {hist.length ? "Retake" : "Begin"} →
                </Link>
              </div>
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
