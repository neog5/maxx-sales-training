import Skeleton from "@/components/Skeleton";
import StatusBadge from "@/components/StatusBadge";

function CheckpointSkeleton() {
  return (
    <div className="checkpoint-skeleton" aria-busy="true" aria-label="Loading reading questions">
      <Skeleton className="checkpoint-skeleton__count" />
      <Skeleton className="checkpoint-skeleton__badge" />
      <Skeleton className="checkpoint-skeleton__question" />
      <Skeleton className="checkpoint-skeleton__option" />
      <Skeleton className="checkpoint-skeleton__option" />
      <Skeleton className="checkpoint-skeleton__option" />
      <span className="tp-sr-only" role="status">Loading reading questions…</span>
    </div>
  );
}

// `feedback` is the database’s verdict on the selected answer ({ correct, explanation }), or
// null before checking. A wrong answer only marks the chosen option; the right one isn’t revealed.
function ActiveCheckpoint({ question, location, selectedAnswer, feedback, checking, onSelect, onAction }) {
  const answerChecked = Boolean(feedback);
  const actionLabel = checking ? "Checking…" : !answerChecked ? "Check answer" : feedback.correct ? "Continue reading" : "Try again";
  return (
    <div className="tp-fade-in">
      <StatusBadge tone="warn" className="checkpoint-badge">Reading question · {location}</StatusBadge>
      <div className="checkpoint-question">{question.question_text}</div>
      {question.image_url && <img className="question-media question-media--reading" src={question.image_url} alt="Reference for this question" />}
      <div className="checkpoint-options">
        {question.shuffled.map((option) => {
          const selected = selectedAnswer === option.originalIndex;
          const isCorrect = answerChecked && selected && feedback.correct;
          const isWrong = answerChecked && selected && !feedback.correct;
          const stateClass = isCorrect ? "is-correct" : isWrong ? "is-wrong" : !answerChecked && selected ? "sel" : "";
          return (
            <button
              type="button"
              key={option.originalIndex}
              className={`tp-opt checkpoint-option ${stateClass}`}
              aria-pressed={selected}
              disabled={answerChecked || checking}
              onClick={() => onSelect(option.originalIndex)}
            >
              <span className="checkpoint-option__text">{option.text}</span>
              {isCorrect && <span className="answer-mark" aria-hidden="true">✓</span>}
              {isWrong && <span className="answer-mark" aria-hidden="true">×</span>}
            </button>
          );
        })}
      </div>
      <div aria-live="polite">
        {answerChecked && (
          <div className={feedback.correct ? "answer-feedback is-correct" : "answer-feedback is-wrong"}>
            {feedback.correct ? "Correct. " : "That answer is incorrect. "}{feedback.explanation}
          </div>
        )}
      </div>
      <div className="checkpoint-actions">
        <button type="button" className="tp-btn tp-btn-primary" disabled={selectedAnswer === undefined || checking} onClick={onAction}>{actionLabel}</button>
      </div>
    </div>
  );
}

// The side panel that asks a question when the reader reaches its page.
// `location` describes where the active question sits, e.g. "deck 2, page 4".
export default function CheckpointCard({ loading, questionCount, answeredCount, multiDeck, activeQuestion, location, selectedAnswer, feedback, checking, onSelect, onAction }) {
  if (loading) {
    return <div className="tp-card reading-question-card"><CheckpointSkeleton /></div>;
  }

  return (
    <div className="tp-card reading-question-card">
      <div className="checkpoint-count">{answeredCount}/{questionCount} reading questions completed</div>
      {activeQuestion ? (
        <ActiveCheckpoint
          question={activeQuestion}
          location={location}
          selectedAnswer={selectedAnswer}
          feedback={feedback}
          checking={checking}
          onSelect={onSelect}
          onAction={onAction}
        />
      ) : questionCount > 0 && answeredCount === questionCount ? (
        <div className="reading-question-complete tp-fade-in">
          <div className="reading-question-complete__icon">✓</div>
          <div className="tp-display">Reading questions completed</div>
          <p>You answered all {questionCount} reading checkpoints.</p>
        </div>
      ) : (
        <div className="tp-fade-in">
          <div className="tp-label checkpoint-idle__label">Reading questions</div>
          <div className="checkpoint-idle__copy">
            {!questionCount
              ? "No reading questions have been added for this course."
              : multiDeck
                ? "Keep reading through each deck. This panel will change when you reach the next question."
                : "Keep scrolling through the PDF. This panel will change when you reach the next question."}
          </div>
        </div>
      )}
    </div>
  );
}
