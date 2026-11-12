"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackToCourses from "@/components/BackToCourses";
import Notice from "@/components/Notice";
import { AssessmentSkeleton } from "@/components/Skeleton";
import { attemptResult, shuffleOptions } from "@/lib/assessment";
import { MAX_ATTEMPTS } from "@/lib/attempts";
import { createClient } from "@/lib/supabase/client";
import QuizResults from "./QuizResults";

const OUT_OF_ATTEMPTS = /no attempts left/i;

function LockedNotice({ course }) {
  return (
    <div className="assessment-page assessment-locked tp-fade-in">
      <div className="tp-display assessment-locked__title">Assessment locked</div>
      <p className="assessment-locked__copy">
        You have used all {MAX_ATTEMPTS} attempts for {course.title}. Ask your admin to give you more attempts. In the meantime, you can read the course again.
      </p>
      <BackToCourses />
    </div>
  );
}

// The database picks the questions, stores the attempt, and grades it (migration 011):
// start_attempt sends the questions without answers, submit_attempt returns the result.
export default function QuizClient({ course, attemptsLeft: initialAttemptsLeft }) {
  const [supabase] = useState(createClient);
  const router = useRouter();
  const [attemptsLeft, setAttemptsLeft] = useState(initialAttemptsLeft);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attemptId, setAttemptId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null); // attemptResult() output
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const locked = attemptsLeft <= 0;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = questions.length > 0 && questions.every((question) => answers[question.id] !== undefined);

  // Each round starts (or resumes) an attempt; retake() starts the next round.
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (locked) return;
    let current = true;
    supabase.rpc("start_attempt", { p_course_id: course.id }).then(({ data, error }) => {
      if (!current) return;
      if (error && OUT_OF_ATTEMPTS.test(error.message)) {
        setAttemptsLeft(0);
      } else {
        setLoadError(error ? "We couldn’t load the assessment questions. Refresh the page to try again." : "");
        setAttemptId(data?.attempt_id || null);
        setQuestions((data?.questions || []).map((question) => shuffleOptions(question)));
      }
      setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [locked, supabase, course.id, round]);

  async function submit() {
    setSubmitting(true);
    setSubmitError("");
    const { data, error } = await supabase.rpc("submit_attempt", { p_attempt_id: attemptId, p_answers: answers });
    if (error) {
      setSubmitError(OUT_OF_ATTEMPTS.test(error.message)
        ? "You have no attempts left for this course. Ask your admin to give you more attempts."
        : "Your attempt could not be saved. Please try again.");
      setSubmitting(false);
      return;
    }
    setResult(attemptResult(data));
    setAttemptsLeft(data.attempts_left);
    setSubmitting(false);
  }

  function retake() {
    setResult(null);
    setAnswers({});
    setAttemptId(null);
    setLoading(true);
    setRound((value) => value + 1);
    router.refresh();
    window.scrollTo({ top: 0 });
  }

  if (result) {
    return <QuizResults course={course} result={result} attemptsLeft={attemptsLeft} onRetake={retake} />;
  }
  if (locked) return <LockedNotice course={course} />;
  if (loading) return <AssessmentSkeleton showNav={false} />;

  return (
    <div className="assessment-page tp-fade-in">
      <BackToCourses />
      <header className="assessment-header">
        <div className="tp-label">{course.title} · Step 2 of 2</div>
        <div className="assessment-header__title">
          <h1 className="tp-display">Assessment</h1>
          {questions.length > 0 && <span className="tp-mono">{answeredCount} of {questions.length} answered</span>}
        </div>
        <div className="assessment-progress" aria-label={`${answeredCount} of ${questions.length} questions answered`}>
          <span style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
        </div>
        <p>
          Choose the best answer for each question. To pass, you need a score of at least {course.pass_threshold}%
          {questions.some((question) => question.is_mandatory) && <> and every question marked <b>Mandatory</b> answered correctly</>}.
          {" "}You have {attemptsLeft} of {MAX_ATTEMPTS} attempts left.
        </p>
      </header>

      <Notice tone="error">{loadError}</Notice>
      {!loadError && questions.length === 0 && <Notice>This assessment has no questions yet. Please check back later or ask your admin.</Notice>}

      <div className="assessment-list">
        {questions.map((question, index) => (
          <section key={question.id} className="tp-card assessment-card" aria-labelledby={`question-${question.id}`}>
            <div className="assessment-question">
              <span className="assessment-question__number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                {question.is_mandatory && <span className="tp-badge question-mandatory-badge">Mandatory</span>}
                <h2 id={`question-${question.id}`}>{question.question_text}</h2>
              </div>
            </div>
            {question.image_url && <img className="question-media question-media--assessment" src={question.image_url} alt="Reference for this question" />}
            <div className="assessment-options" role="group" aria-labelledby={`question-${question.id}`}>
              {question.shuffled.map((option) => {
                const selected = answers[question.id] === option.originalIndex;
                return (
                  <button
                    type="button"
                    key={option.originalIndex}
                    className={selected ? "tp-opt sel" : "tp-opt"}
                    aria-pressed={selected}
                    onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.originalIndex }))}
                  >
                    <span className="assessment-option__radio">{selected && <i />}</span>
                    <span>{option.text}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <Notice tone="error" className="assessment-submit__error">{submitError}</Notice>
      {questions.length > 0 && <div className="assessment-submit">
        <button type="button" className="tp-btn tp-btn-primary assessment-submit__button" disabled={!allAnswered || !attemptId || submitting} onClick={submit}>
          {submitting ? "Submitting…" : allAnswered ? "Submit assessment" : `Answer all to submit (${questions.length - answeredCount} left)`}
        </button>
      </div>}
    </div>
  );
}
