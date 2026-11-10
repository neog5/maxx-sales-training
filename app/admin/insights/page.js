import Link from "next/link";
import LocalDate from "@/components/LocalDate";
import QuestionPerformance from "@/components/QuestionPerformance";
import StatusBadge from "@/components/StatusBadge";
import { calculateQuestionPerformance } from "@/lib/assessment";
import { summarizeAttemptsByUser } from "@/lib/attempt-stats";
import { requireViewer } from "@/lib/auth";
import { fetchAll } from "@/lib/db";
import { byName, displayName } from "@/lib/people";
import { fetchPeople } from "@/lib/queries";
import { canViewReports } from "@/lib/roles";
import { routes } from "@/lib/routes";
import AdminPage from "../AdminPage";

// People with attempts first, lowest pass rate first.
function byPassRate(a, b) {
  if (!a.attemptCount && b.attemptCount) return 1;
  if (a.attemptCount && !b.attemptCount) return -1;
  return (a.passRate ?? 101) - (b.passRate ?? 101) || byName(a, b);
}

function MetricCard({ label, value, accent = false }) {
  return (
    <div className="tp-card metric-card">
      <div className="tp-label">{label}</div>
      <div className={`tp-mono metric-value ${accent ? "metric-value--accent" : ""}`}>{value}</div>
    </div>
  );
}

export default async function InsightsPage() {
  const { supabase, profile } = await requireViewer(canViewReports);

  const [attempts, people, attemptQuestions] = await Promise.all([
    fetchAll(
      () => supabase
        .from("quiz_attempts")
        .select("id, score, passed, submitted_at, user_id, courses(title)")
        .eq("status", "completed")
        .order("submitted_at", { ascending: false })
        .order("id"),
      "completed attempts"
    ),
    fetchPeople(supabase, "id, full_name, email, role"),
    fetchAll(() => supabase.from("attempt_questions").select("attempt_id, is_mandatory, image_url, is_correct").order("id"), "answered questions"),
  ]);

  const personById = new Map(people.map((person) => [person.id, person]));
  const total = attempts.length;
  const passRate = total ? Math.round((attempts.filter((attempt) => attempt.passed).length / total) * 100) : 0;
  const avgScore = total ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / total) : 0;

  const statsFor = summarizeAttemptsByUser(attempts);
  const userPerformance = people.map((person) => ({ ...person, ...statsFor(person.id) })).sort(byPassRate);
  const questionPerformance = calculateQuestionPerformance(attemptQuestions);
  const questionsByAttempt = new Map();
  for (const question of attemptQuestions) {
    questionsByAttempt.set(question.attempt_id, (questionsByAttempt.get(question.attempt_id) || 0) + 1);
  }

  return (
    <AdminPage profile={profile}>
      <main className="tp-page">
        <div className="page-heading">
          <div className="tp-label">Admin workspace</div>
          <h1 className="tp-display">Assessment insights</h1>
          <p>Compare learner outcomes, question-type accuracy, and individual assessment attempts.</p>
        </div>

        <div className="metric-grid metric-grid--admin">
          <MetricCard label="Users" value={people.length} />
          <MetricCard label="Completed attempts" value={total} />
          <MetricCard label="Pass rate" value={`${passRate}%`} accent />
          <MetricCard label="Average score" value={`${avgScore}%`} />
        </div>

        <div className="admin-insight-grid">
          <section>
            <div className="section-heading-row">
              <div>
                <div className="tp-label">Performance by user</div>
                <span>Lowest pass rate first</span>
              </div>
              <Link href={routes.people} className="section-heading-link">View all people</Link>
            </div>
            <div className="tp-card user-performance-list">
              {userPerformance.slice(0, 6).map((person) => (
                <Link href={routes.profile(person.id)} className="user-performance-list__item" key={person.id}>
                  <span>
                    <strong>{displayName(person)}</strong>
                    <small>{person.attemptCount ? `${person.attemptCount} completed ${person.attemptCount === 1 ? "attempt" : "attempts"}` : "No completed attempts"}</small>
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
          <div className="tp-card attempt-table">
            <div className="attempt-table__head">
              <div>User</div><div>Course</div><div>Score</div><div>Result</div><div>Questions</div><div>Date</div><div></div>
            </div>
            <div className="tp-scroll attempt-table__body">
              {attempts.map((attempt) => (
                <div key={attempt.id} className="attempt-table__row">
                  <div><Link className="profile-link" href={routes.profile(attempt.user_id)}>{personById.has(attempt.user_id) ? displayName(personById.get(attempt.user_id)) : "Team member"}</Link></div>
                  <div className="attempt-table__course">{attempt.courses?.title}</div>
                  <div className="tp-mono">{attempt.score}%</div>
                  <div><StatusBadge tone={attempt.passed ? "success" : "danger"}>{attempt.passed ? "Passed" : "Failed"}</StatusBadge></div>
                  <div className="tp-mono">{questionsByAttempt.get(attempt.id) || 0}</div>
                  <div className="attempt-table__date"><LocalDate value={attempt.submitted_at} /></div>
                  <div><Link href={routes.attempt(attempt.user_id, attempt.id)} className="tp-btn tp-btn-ghost attempt-review-link">Review</Link></div>
                </div>
              ))}
              {total === 0 && <div className="admin-insight-empty">No completed attempts yet.</div>}
            </div>
          </div>
        </section>
      </main>
    </AdminPage>
  );
}
