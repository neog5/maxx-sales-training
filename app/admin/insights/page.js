import Link from "next/link";
import LocalDate from "@/components/LocalDate";
import QuestionPerformance from "@/components/QuestionPerformance";
import StatusBadge from "@/components/StatusBadge";
import { calculateQuestionPerformance } from "@/lib/assessment";
import { requiredAttemptsOnly, summarizeAttemptsByUser } from "@/lib/attempt-stats";
import { requireViewer } from "@/lib/auth";
import { fetchAll } from "@/lib/db";
import { byName, displayName } from "@/lib/people";
import { fetchPeople } from "@/lib/queries";
import { isAdmin } from "@/lib/roles";
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
  const { supabase, profile } = await requireViewer(isAdmin);

  const [allAttempts, people, allAttemptQuestions, requiredPairs] = await Promise.all([
    fetchAll(
      () => supabase
        .from("quiz_attempts")
        .select("id, score, passed, submitted_at, user_id, course_id, courses(title)")
        .eq("status", "completed")
        .order("submitted_at", { ascending: false })
        .order("id"),
      "completed attempts"
    ),
    fetchPeople(supabase, "id, full_name, email, role, archived_at", { includeArchived: true }),
    fetchAll(() => supabase.from("attempt_questions").select("attempt_id, is_mandatory, image_url, is_correct").order("id"), "answered questions"),
    fetchAll(() => supabase.rpc("required_courses").order("user_id").order("course_id"), "required courses"),
  ]);

  // Every figure counts only attempts on courses the person is required to complete; optional
  // courses don't affect anyone's numbers. The attempt log below still lists every attempt.
  const attempts = requiredAttemptsOnly(allAttempts, requiredPairs);
  const requiredAttemptIds = new Set(attempts.map((attempt) => attempt.id));
  const attemptQuestions = allAttemptQuestions.filter((question) => requiredAttemptIds.has(question.attempt_id));
  const requiredIds = requiredAttemptIds;

  const personById = new Map(people.map((person) => [person.id, person]));
  const total = attempts.length;
  const passRate = total ? Math.round((attempts.filter((attempt) => attempt.passed).length / total) * 100) : 0;
  const avgScore = total ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / total) : 0;

  const statsFor = summarizeAttemptsByUser(attempts);
  const activePeople = people.filter((person) => !person.archived_at);
  const userPerformance = activePeople.map((person) => ({ ...person, ...statsFor(person.id) })).sort(byPassRate);
  const questionPerformance = calculateQuestionPerformance(attemptQuestions);
  const questionsByAttempt = new Map();
  for (const question of allAttemptQuestions) {
    questionsByAttempt.set(question.attempt_id, (questionsByAttempt.get(question.attempt_id) || 0) + 1);
  }

  return (
    <AdminPage profile={profile}>
      <main className="tp-page">
        <div className="page-heading">
          <h1 className="tp-display">Assessment insights</h1>
        </div>

        <div className="metric-grid metric-grid--admin">
          <MetricCard label="People" value={activePeople.length} />
          <MetricCard label="Completed attempts (required courses)" value={total} />
          <MetricCard label="Pass rate" value={`${passRate}%`} accent />
          <MetricCard label="Average score" value={`${avgScore}%`} />
        </div>

        <div className="admin-insight-grid">
          <section>
            <div className="section-heading-row">
              <div>
                <div className="tp-label">Performance by person · required courses</div>
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
              {userPerformance.length === 0 && <div className="admin-insight-empty">No people yet.</div>}
            </div>
          </section>

          <section>
            <div className="section-heading-row">
              <div>
                <div className="tp-label">Performance by question type · required courses</div>
              </div>
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
            </div>
          </div>
          <div className="tp-card attempt-table">
            <div className="attempt-table__head">
              <div>Person</div><div>Course</div><div>Score</div><div>Result</div><div>Questions</div><div>Date</div><div></div>
            </div>
            <div className="tp-scroll attempt-table__body">
              {allAttempts.map((attempt) => (
                <div key={attempt.id} className="attempt-table__row">
                  <div><Link className="profile-link" href={routes.profile(attempt.user_id)}>{personById.has(attempt.user_id) ? displayName(personById.get(attempt.user_id)) : "Team member"}</Link></div>
                  <div className="attempt-table__course">{attempt.courses?.title}</div>
                  <div className="tp-mono">{attempt.score}%</div>
                  <div><StatusBadge tone={attempt.passed ? "success" : "danger"}>{attempt.passed ? "Passed" : "Not passed"}</StatusBadge>{!requiredIds.has(attempt.id) && <small className="attempt-optional"> Optional</small>}</div>
                  <div className="tp-mono">{questionsByAttempt.get(attempt.id) || 0}</div>
                  <div className="attempt-table__date"><LocalDate value={attempt.submitted_at} /></div>
                  <div><Link href={routes.attempt(attempt.user_id, attempt.id)} className="tp-btn tp-btn-ghost attempt-review-link">Review</Link></div>
                </div>
              ))}
              {allAttempts.length === 0 && <div className="admin-insight-empty">No completed attempts yet.</div>}
            </div>
          </div>
        </section>
      </main>
    </AdminPage>
  );
}
