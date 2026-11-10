import Link from "next/link";
import BackToCourses from "@/components/BackToCourses";
import Dial from "@/components/Dial";
import StatusBadge from "@/components/StatusBadge";
import { MAX_ATTEMPTS } from "@/lib/attempts";
import { routes } from "@/lib/routes";

function ReviewCard({ question, number }) {
  return (
    <div className={`tp-card assessment-review-card ${question.is_correct ? "is-correct" : "is-wrong"}`}>
      <div className="assessment-review-card__row">
        <span className="tp-mono assessment-review-card__number">{String(number).padStart(2, "0")}</span>
        <div className="assessment-review-card__body">
          <div className="assessment-review-card__question">{question.question_text}</div>
          {question.image_url && <img className="question-media question-media--review" src={question.image_url} alt="Reference for this question" />}
          <div className="review-options">
            {question.options.map((option, index) => {
              const isCorrect = index === question.correct_index;
              const isWrongSelection = index === question.selected_index && !question.is_correct;
              return (
                <div key={index} className={`review-option ${isCorrect ? "is-correct" : ""} ${isWrongSelection ? "is-wrong" : ""}`}>
                  <span>{option}</span>
                  {isCorrect && <strong>Correct</strong>}
                  {isWrongSelection && <strong>Your answer</strong>}
                </div>
              );
            })}
          </div>
          <div className="assessment-review-card__explanation">{question.explanation}</div>
        </div>
      </div>
    </div>
  );
}

// `result` is attemptResult() output; `attemptsLeft` already counts this attempt.
export default function QuizResults({ course, result, attemptsLeft, onRetake }) {
  return (
    <div className="assessment-page tp-fade-in">
      <div className="tp-label">{course.code} · Assessment results</div>
      <h1 className="tp-display assessment-results-title">Results</h1>

      <div className={`tp-card assessment-result-card ${result.passed ? "is-passed" : "is-failed"}`}>
        <Dial pct={result.score} size={120} color={result.passed ? "var(--success)" : "var(--danger)"} label={`${result.score}%`} sub="score" />
        <div className="assessment-result-card__copy">
          <StatusBadge tone={result.passed ? "success" : "danger"}>{result.passed ? "Passed" : "Not passed"}</StatusBadge>
          <h2 className="tp-display">{result.passed ? "Course complete" : "Keep building your knowledge"}</h2>
          <div className="assessment-result-card__detail">
            {result.correctCount} of {result.total} correct · threshold {course.pass_threshold}%
          </div>
          <div className={`assessment-requirement ${result.mandatoryPassed ? "is-met" : "is-unmet"}`}>
            <strong>{result.mandatoryCount ? `Mandatory questions: ${result.mandatoryCorrectCount} of ${result.mandatoryCount} correct` : "No mandatory questions in this assessment"}</strong>
            <span>{result.mandatoryPassed ? "Requirement met" : "All mandatory questions must be correct to pass"}</span>
          </div>
          {result.passed && result.certificateId && (
            <div className="assessment-result-card__actions">
              <Link href={routes.certificate(result.certificateId)} className="tp-btn tp-btn-primary">View certificate</Link>
            </div>
          )}
          {!result.passed && attemptsLeft > 0 && (
            <div className="assessment-result-card__actions">
              <div className="assessment-result-card__detail assessment-result-card__attempts">{attemptsLeft} of {MAX_ATTEMPTS} attempts left</div>
              <button type="button" className="tp-btn tp-btn-primary" onClick={onRetake}>Retake assessment</button>
            </div>
          )}
          {!result.passed && attemptsLeft <= 0 && (
            <div className="assessment-result-card__detail assessment-result-card__actions">
              You have used all {MAX_ATTEMPTS} attempts. Ask an admin to approve more attempts.
            </div>
          )}
        </div>
      </div>

      <div className="tp-label assessment-review-label">Question review</div>
      <div className="assessment-review-list">
        {result.questions.map((question, index) => <ReviewCard key={question.id} question={question} number={index + 1} />)}
      </div>

      <div className="assessment-back"><BackToCourses /></div>
    </div>
  );
}
