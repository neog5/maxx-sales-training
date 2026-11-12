import Link from "next/link";
import LocalDate from "@/components/LocalDate";
import QuestionPerformance from "@/components/QuestionPerformance";
import StatusBadge from "@/components/StatusBadge";
import TopNav from "@/components/TopNav";
import { calculateQuestionPerformance, summarizeAnswers } from "@/lib/assessment";
import { requireSelfOrReports } from "@/lib/auth";
import { must, mustFind } from "@/lib/db";
import { displayName } from "@/lib/people";
import { routes } from "@/lib/routes";

export default async function AttemptPage({ params }) {
  const { id, attemptId } = await params;
  const { supabase, profile: viewer } = await requireSelfOrReports(id);

  const [person, attempt] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("id", id).maybeSingle().then((result) => mustFind(result, "this person")),
    supabase
      .from("quiz_attempts")
      .select("id, score, passed, submitted_at, courses(title, code, pass_threshold)")
      .eq("id", attemptId)
      .eq("user_id", id)
      .eq("status", "completed")
      .maybeSingle()
      .then((result) => mustFind(result, "the attempt")),
  ]);

  const questions = must(
    await supabase
      .from("attempt_questions")
      .select("id, position, question_text, image_url, is_mandatory, options, correct_index, explanation, selected_index, is_correct")
      .eq("attempt_id", attempt.id)
      .order("position", { ascending: true })
      .order("id", { ascending: true }),
    "the attempt's questions"
  ) || [];
  const { total, correctCount, mandatoryCount, mandatoryCorrectCount, mandatoryPassed } = summarizeAnswers(questions);
  const name = displayName(person);

  return (
    <div>
      <TopNav profile={viewer} />
      <main className="tp-page attempt-detail-page tp-fade-in">
        <Link href={routes.profile(person.id)} className="tp-btn tp-btn-ghost back-link">← Back to {name}</Link>

        <div className="page-heading attempt-detail-heading">
          <div>
            <div className="tp-label">Attempt review · {attempt.courses?.code || "Assessment"}</div>
            <h1 className="tp-display">{attempt.courses?.title || "Assessment attempt"}</h1>
            <p>{name} · submitted <LocalDate value={attempt.submitted_at} withTime /></p>
          </div>
          <StatusBadge tone={attempt.passed ? "success" : "danger"} className="attempt-detail-result">{attempt.passed ? "Passed" : "Not passed"}</StatusBadge>
        </div>

        <div className="metric-grid metric-grid--attempt">
          <div className="tp-card metric-card">
            <div className="tp-label">Score</div>
            <div className="tp-mono metric-value">{attempt.score}%</div>
            <small>Passing score: {attempt.courses?.pass_threshold ?? "—"}%</small>
          </div>
          <div className="tp-card metric-card">
            <div className="tp-label">Questions correct</div>
            <div className="tp-mono metric-value">{correctCount} of {total}</div>
            <small>{total ? Math.round((correctCount / total) * 100) : 0}% accuracy</small>
          </div>
          {mandatoryCount > 0 && (
            <div className={`tp-card metric-card mandatory-metric ${mandatoryPassed ? "is-met" : "is-unmet"}`}>
              <div className="tp-label">Mandatory questions</div>
              <div className="tp-mono metric-value">{mandatoryCorrectCount} of {mandatoryCount}</div>
              <small>{mandatoryPassed ? "All mandatory questions correct" : "Every mandatory question must be right to pass"}</small>
            </div>
          )}
        </div>

        <section className="profile-report-section">
          <div className="section-heading-row">
            <div>
              <div className="tp-label">Performance by question type</div>
              <span>This attempt only</span>
            </div>
          </div>
          <div className="tp-card question-performance-card">
            <QuestionPerformance groups={calculateQuestionPerformance(questions)} />
          </div>
        </section>

        <section className="attempt-question-section">
          <div className="section-heading-row">
            <div>
              <div className="tp-label">Questions asked</div>
              <span>{total} {total === 1 ? "question" : "questions"} in this attempt</span>
            </div>
          </div>
          <div className="attempt-question-list">
            {questions.map((question, index) => (
              <article key={question.id} className={`tp-card attempt-question ${question.is_correct ? "is-correct" : "is-wrong"}`}>
                <div className="attempt-question__header">
                  <span className="assessment-question__number">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="attempt-question__badges">
                      {question.is_mandatory && <span className="tp-badge question-mandatory-badge">Mandatory</span>}
                      {question.image_url && <span className="tp-badge">Image-based</span>}
                      <StatusBadge tone={question.is_correct ? "success" : "danger"}>{question.is_correct ? "Correct" : "Incorrect"}</StatusBadge>
                    </div>
                    <h2>{question.question_text}</h2>
                  </div>
                </div>
                {question.image_url && <img className="question-media question-media--attempt" src={question.image_url} alt="Reference shown with this question" />}
                <div className="review-options attempt-question__options">
                  {(question.options || []).map((option, optionIndex) => {
                    const isCorrect = optionIndex === question.correct_index;
                    const isSelected = optionIndex === question.selected_index;
                    return (
                      <div key={optionIndex} className={`review-option ${isCorrect ? "is-correct" : ""} ${isSelected && !isCorrect ? "is-wrong" : ""}`}>
                        <span>{option}</span>
                        <strong>{isCorrect ? "Correct answer" : isSelected ? "User answer" : ""}</strong>
                      </div>
                    );
                  })}
                </div>
                {question.selected_index === null && <div className="attempt-question__unanswered">No answer recorded</div>}
                <div className="attempt-question__explanation"><strong>Explanation</strong>{question.explanation}</div>
              </article>
            ))}
            {questions.length === 0 && <div className="tp-card admin-insight-empty">No question snapshots were recorded for this attempt.</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
