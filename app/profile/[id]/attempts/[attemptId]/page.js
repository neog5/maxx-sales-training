import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import QuestionPerformance from "@/components/QuestionPerformance";
import TopNav from "@/components/TopNav";
import { calculateQuestionPerformance } from "@/lib/assessment.mjs";
import { createClient } from "@/lib/supabase/server";

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AttemptPage({ params }) {
  const { id, attemptId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viewer } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!viewer) redirect("/login");
  if (viewer?.role !== "admin" && user.id !== id) redirect(`/profile/${user.id}`);

  const [{ data: person }, { data: attempt }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role").eq("id", id).single(),
    supabase
      .from("quiz_attempts")
      .select("id, user_id, score, passed, submitted_at, status, courses(title, code, pass_threshold)")
      .eq("id", attemptId)
      .eq("user_id", id)
      .eq("status", "completed")
      .maybeSingle(),
  ]);
  if (!person || !attempt) notFound();

  const { data: attemptQuestions } = await supabase
    .from("attempt_questions")
    .select("id, position, question_text, image_url, is_mandatory, options, correct_index, explanation, selected_index, is_correct")
    .eq("attempt_id", attempt.id)
    .order("position", { ascending: true })
    .order("id", { ascending: true });
  const questions = attemptQuestions || [];
  const correctCount = questions.filter((question) => question.is_correct).length;
  const mandatoryQuestions = questions.filter((question) => question.is_mandatory);
  const mandatoryCorrect = mandatoryQuestions.filter((question) => question.is_correct).length;
  const mandatoryMet = mandatoryCorrect === mandatoryQuestions.length;
  const questionPerformance = calculateQuestionPerformance(questions);

  return (
    <div>
      <TopNav profile={viewer} />
      <main className="tp-page attempt-detail-page tp-fade-in">
        <Link href={`/profile/${person.id}`} className="tp-btn tp-btn-ghost back-link">← Back to {person.full_name}</Link>

        <div className="page-heading attempt-detail-heading">
          <div>
            <div className="tp-label">Attempt review · {attempt.courses?.code || "Assessment"}</div>
            <h1 className="tp-display">{attempt.courses?.title || "Assessment attempt"}</h1>
            <p>{person.full_name} · submitted {formatDate(attempt.submitted_at)}</p>
          </div>
          <span className="tp-badge attempt-detail-result" style={{ background: attempt.passed ? "var(--success-dim)" : "var(--danger-dim)", color: attempt.passed ? "var(--success)" : "var(--danger)" }}>
            {attempt.passed ? "Passed" : "Failed"}
          </span>
        </div>

        <div className="metric-grid metric-grid--attempt">
          <div className="tp-card metric-card">
            <div className="tp-label">Score</div>
            <div className="tp-mono metric-value">{attempt.score}%</div>
            <small>Threshold {attempt.courses?.pass_threshold ?? "—"}%</small>
          </div>
          <div className="tp-card metric-card">
            <div className="tp-label">Questions correct</div>
            <div className="tp-mono metric-value">{correctCount}/{questions.length}</div>
            <small>{questions.length ? Math.round((correctCount / questions.length) * 100) : 0}% accuracy</small>
          </div>
          <div className={`tp-card metric-card mandatory-metric ${mandatoryMet ? "is-met" : "is-unmet"}`}>
            <div className="tp-label">Mandatory requirement</div>
            <div className="tp-mono metric-value">{mandatoryQuestions.length ? `${mandatoryCorrect}/${mandatoryQuestions.length}` : "—"}</div>
            <small>{mandatoryQuestions.length ? (mandatoryMet ? "All mandatory questions correct" : "Requirement not met") : "No mandatory questions asked"}</small>
          </div>
        </div>

        <section className="profile-report-section">
          <div className="section-heading-row">
            <div>
              <div className="tp-label">Performance by question type</div>
              <span>This attempt only</span>
            </div>
            <span>Groups can overlap</span>
          </div>
          <div className="tp-card question-performance-card">
            <QuestionPerformance groups={questionPerformance} />
          </div>
        </section>

        <section className="attempt-question-section">
          <div className="section-heading-row">
            <div>
              <div className="tp-label">Questions asked</div>
              <span>{questions.length} {questions.length === 1 ? "question" : "questions"} in this attempt</span>
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
                      <span className="tp-badge" style={{ background: question.is_correct ? "var(--success-dim)" : "var(--danger-dim)", color: question.is_correct ? "var(--success)" : "var(--danger)" }}>
                        {question.is_correct ? "Correct" : "Incorrect"}
                      </span>
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
