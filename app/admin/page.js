import { redirect } from "next/navigation";
import Link from "next/link";
import TopNav from "@/components/TopNav";
import QuestionPerformance from "@/components/QuestionPerformance";
import { calculateQuestionPerformance } from "@/lib/assessment.mjs";
import { createClient } from "@/lib/supabase/server";
import AdminTabs from "./AdminTabs";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/courses");

  const [{ data: attempts }, { data: people }, { data: attemptQuestions }] = await Promise.all([
    supabase
      .from("quiz_attempts")
      .select("id, score, passed, submitted_at, status, user_id, course_id, courses(title, code)")
      .eq("status", "completed")
      .order("submitted_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, role"),
    supabase
      .from("attempt_questions")
      .select("attempt_id, is_mandatory, image_url, is_correct"),
  ]);

  const personById = new Map((people || []).map((person) => [person.id, person]));
  const learnerCount = people?.length || 0;
  const total = attempts?.length || 0;
  const passRate = total ? Math.round((attempts.filter((attempt) => attempt.passed).length / total) * 100) : 0;
  const avgScore = total ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / total) : 0;

  const performanceByUser = new Map((people || []).map((person) => [person.id, {
    ...person,
    attempts: 0,
    passed: 0,
    scoreTotal: 0,
  }]));
  for (const attempt of attempts || []) {
    const current = performanceByUser.get(attempt.user_id);
    if (!current) continue;
    current.attempts += 1;
    current.passed += attempt.passed ? 1 : 0;
    current.scoreTotal += attempt.score || 0;
  }
  const userPerformance = [...performanceByUser.values()]
    .map((person) => ({
      ...person,
      averageScore: person.attempts ? Math.round(person.scoreTotal / person.attempts) : null,
      passRate: person.attempts ? Math.round((person.passed / person.attempts) * 100) : null,
    }))
    .sort((a, b) => {
      if (!a.attempts && b.attempts) return 1;
      if (a.attempts && !b.attempts) return -1;
      return (a.passRate ?? 101) - (b.passRate ?? 101) || a.full_name.localeCompare(b.full_name);
    });
  const questionPerformance = calculateQuestionPerformance(attemptQuestions || []);
  const questionsByAttempt = new Map();
  for (const question of attemptQuestions || []) {
    questionsByAttempt.set(question.attempt_id, (questionsByAttempt.get(question.attempt_id) || 0) + 1);
  }

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
          <p>Compare learner outcomes, question-type accuracy, and individual assessment attempts.</p>
        </div>

        <div className="metric-grid metric-grid--admin">
          <div className="tp-card metric-card">
            <div className="tp-label">Users</div>
            <div className="tp-mono metric-value">{learnerCount}</div>
          </div>
          <div className="tp-card metric-card">
            <div className="tp-label">Completed attempts</div>
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
              <div>
                <div className="tp-label">Performance by user</div>
                <span>Lowest pass rate first</span>
              </div>
              <Link href="/admin/people" className="section-heading-link">View all people</Link>
            </div>
            <div className="tp-card user-performance-list">
              {userPerformance.slice(0, 6).map((person) => (
                <Link href={`/profile/${person.id}`} className="user-performance-list__item" key={person.id}>
                  <span>
                    <strong>{person.full_name || "Team member"}</strong>
                    <small>{person.attempts ? `${person.attempts} completed ${person.attempts === 1 ? "attempt" : "attempts"}` : "No completed attempts"}</small>
                  </span>
                  <span className="user-performance-list__scores">
                    <strong className="tp-mono">{person.averageScore === null ? "—" : `${person.averageScore}%`}</strong>
                    <small>{person.passRate === null ? "No pass rate" : `${person.passRate}% pass`}</small>
                  </span>
                </Link>
              ))}
              {userPerformance.length === 0 && <div className="admin-insight-empty">User performance will appear after profiles are created.</div>}
            </div>
          </section>

          <section>
            <div className="section-heading-row">
              <div>
                <div className="tp-label">Performance by question type</div>
                <span>Accuracy across all completed attempts</span>
              </div>
              <span>Groups can overlap</span>
            </div>
            <div className="tp-card question-performance-card">
              <QuestionPerformance groups={questionPerformance} compact />
            </div>
          </section>
        </div>

        <section className="attempt-log-section">
          <div className="section-heading-row">
            <div>
              <div className="tp-label">Attempt log</div>
              <span>Open an attempt to review every question and answer</span>
            </div>
          </div>
          <div className="tp-card attempt-table" style={{ overflow: "hidden" }}>
            <div className="attempt-table__head">
              <div>User</div><div>Course</div><div>Score</div><div>Result</div><div>Questions</div><div>Date</div><div></div>
            </div>
            <div className="tp-scroll" style={{ maxHeight: 440, overflowY: "auto" }}>
              {(attempts || []).map((attempt) => (
                <div key={attempt.id} className="attempt-table__row">
                  <div><Link className="profile-link" href={`/profile/${attempt.user_id}`}>{personById.get(attempt.user_id)?.full_name || "Team member"}</Link></div>
                  <div style={{ color: "var(--dim)" }}>{attempt.courses?.title}</div>
                  <div className="tp-mono">{attempt.score}%</div>
                  <div>
                    <span className="tp-badge" style={{ background: attempt.passed ? "var(--success-dim)" : "var(--danger-dim)", color: attempt.passed ? "var(--success)" : "var(--danger)" }}>
                      {attempt.passed ? "Passed" : "Failed"}
                    </span>
                  </div>
                  <div className="tp-mono">{questionsByAttempt.get(attempt.id) || 0}</div>
                  <div style={{ color: "var(--faint)", fontSize: 12 }}>{new Date(attempt.submitted_at).toLocaleDateString()}</div>
                  <div><Link href={`/profile/${attempt.user_id}/attempts/${attempt.id}`} className="tp-btn tp-btn-ghost attempt-review-link">Review</Link></div>
                </div>
              ))}
              {total === 0 && <div className="admin-insight-empty">No completed attempts yet.</div>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
