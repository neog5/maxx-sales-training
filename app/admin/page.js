import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import AdminTabs from "./AdminTabs";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/courses");

  const [{ data: attempts }, { count: learnerCount }] = await Promise.all([
    supabase
      .from("quiz_attempts")
      .select("id, score, passed, submitted_at, status, user_id, course_id, profiles(full_name, role), courses(title, code)")
      .eq("status", "completed")
      .order("submitted_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "rep"),
  ]);

  const total = attempts?.length || 0;
  const passRate = total ? Math.round((attempts.filter((a) => a.passed).length / total) * 100) : 0;
  const avgScore = total ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / total) : 0;

  const latestAttemptByLearner = new Map();
  for (const attempt of attempts || []) {
    if (attempt.profiles?.role === "rep" && !latestAttemptByLearner.has(attempt.user_id)) {
      latestAttemptByLearner.set(attempt.user_id, attempt);
    }
  }
  const needsAttention = [...latestAttemptByLearner.values()].filter((attempt) => !attempt.passed);

  const coursePerformance = new Map();
  for (const attempt of attempts || []) {
    const current = coursePerformance.get(attempt.course_id) || {
      id: attempt.course_id,
      title: attempt.courses?.title || "Course",
      code: attempt.courses?.code || "",
      attempts: 0,
      passed: 0,
      scoreTotal: 0,
    };
    current.attempts += 1;
    current.passed += attempt.passed ? 1 : 0;
    current.scoreTotal += attempt.score || 0;
    coursePerformance.set(attempt.course_id, current);
  }
  const courseInsights = [...coursePerformance.values()]
    .map((course) => ({
      ...course,
      passRate: Math.round((course.passed / course.attempts) * 100),
      averageScore: Math.round(course.scoreTotal / course.attempts),
    }))
    .sort((a, b) => a.passRate - b.passRate || b.attempts - a.attempts)
    .slice(0, 5);

  return (
    <div>
      <TopNav profile={profile} />
      <div className="admin-nav tp-fade-in">
        <AdminTabs active="dashboard" />
      </div>
      <main className="tp-page">
        <div className="page-heading">
          <div className="tp-label">Admin workspace</div>
          <h1 className="tp-display">Training dashboard</h1>
          <p>Track assessment activity and current team performance at a glance.</p>
        </div>

        <div className="metric-grid metric-grid--admin">
          <div className="tp-card metric-card">
            <div className="tp-label">Learners</div>
            <div className="tp-mono metric-value">{learnerCount || 0}</div>
          </div>
          <div className="tp-card metric-card">
            <div className="tp-label">Total attempts</div>
            <div className="tp-mono metric-value">{total}</div>
          </div>
          <div className="tp-card metric-card">
            <div className="tp-label">Pass rate</div>
            <div className="tp-mono metric-value" style={{ color: "var(--accent)" }}>{passRate}%</div>
          </div>
          <div className="tp-card metric-card">
            <div className="tp-label">Average score</div>
            <div className="tp-mono metric-value">{avgScore}%</div>
          </div>
        </div>

        <div className="admin-insight-grid">
          <section>
            <div className="section-heading-row">
              <div className="tp-label">Learners needing attention</div>
              <Link href="/admin/people?status=needs-attention" className="section-heading-link">View people</Link>
            </div>
            <div className="tp-card attention-list">
              {needsAttention.slice(0, 4).map((attempt) => (
                <Link href={`/profile/${attempt.user_id}`} className="attention-list__item" key={attempt.user_id}>
                  <span>
                    <strong>{attempt.profiles?.full_name || "Team member"}</strong>
                    <small>{attempt.courses?.title || "Course"}</small>
                  </span>
                  <span className="tp-mono">{attempt.score}%</span>
                </Link>
              ))}
              {needsAttention.length === 0 && <div className="admin-insight-empty">No learners currently need attention.</div>}
            </div>
          </section>

          <section>
            <div className="section-heading-row">
              <div className="tp-label">Course performance</div>
              <span>Lowest pass rate first</span>
            </div>
            <div className="tp-card course-performance-list">
              {courseInsights.map((course) => (
                <div className="course-performance-list__item" key={course.id}>
                  <span>
                    <strong>{course.title}</strong>
                    <small>{course.code} · {course.attempts} {course.attempts === 1 ? "attempt" : "attempts"}</small>
                  </span>
                  <span className="course-performance-list__scores">
                    <strong className="tp-mono">{course.passRate}%</strong>
                    <small>{course.averageScore}% avg</small>
                  </span>
                </div>
              ))}
              {courseInsights.length === 0 && <div className="admin-insight-empty">Course insights will appear after the first completed attempt.</div>}
            </div>
          </section>
        </div>

        <div className="tp-label" style={{ marginBottom: 10 }}>Attempt log</div>
        <div className="tp-card" style={{ overflow: "hidden" }}>
          <div className="attempt-table__head">
            <div>Rep</div><div>Course</div><div>Score</div><div>Status</div><div>Date</div>
          </div>
          <div className="tp-scroll" style={{ maxHeight: 400, overflowY: "auto" }}>
            {(attempts || []).map((a) => (
              <div key={a.id} className="attempt-table__row">
                <div><Link className="profile-link" href={`/profile/${a.user_id}`}>{a.profiles?.full_name}</Link></div>
                <div style={{ color: "var(--dim)" }}>{a.courses?.title}</div>
                <div className="tp-mono">{a.score}%</div>
                <div>
                  <span className="tp-badge" style={{ background: a.passed ? "var(--accent-dim)" : "var(--danger-dim)", color: a.passed ? "var(--accent)" : "var(--danger)" }}>
                    {a.passed ? "Passed" : "Failed"}
                  </span>
                </div>
                <div style={{ color: "var(--faint)", fontSize: 12 }}>{new Date(a.submitted_at).toLocaleDateString()}</div>
              </div>
            ))}
            {total === 0 && <div style={{ padding: 20, color: "var(--faint)", fontSize: 13 }}>No completed attempts yet.</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
