"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Dial from "@/components/Dial";
import { AssessmentSkeleton } from "@/components/Skeleton";
import { gradeAssessment } from "@/lib/assessment.mjs";
import { MAX_ATTEMPTS } from "@/lib/attempts.mjs";
import { createClient } from "@/lib/supabase/client";

// Options ship shuffled per question so the correct answer isn't always in the same slot.
function shuffleOptions(q) {
  const options = q.options.map((text, idx) => ({ text, origIdx: idx }));
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { ...q, shuffled: options };
}

function LockedNotice({ course }) {
  return (
    <div className="assessment-page tp-fade-in" style={{ textAlign: "center", paddingTop: 60 }}>
      <div className="tp-display" style={{ fontSize: 18, fontWeight: 700, margin: "20px 0 6px" }}>Assessment locked</div>
      <div style={{ color: "var(--faint)", fontSize: 13, maxWidth: 420, margin: "0 auto 20px" }}>
        You have used all {MAX_ATTEMPTS} attempts for {course.code}. Ask an admin to approve more attempts. In the meantime, revisit the course material.
      </div>
      <Link href="/courses" className="tp-btn tp-btn-ghost back-link">← Back to courses</Link>
    </div>
  );
}

export default function QuizClient({ course, userId, attemptsLeft }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [certificateId, setCertificateId] = useState(null);
  const [result, setResult] = useState(null); // { score, passed, graded: [...] }
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const locked = attemptsLeft <= 0;

  useEffect(() => {
    if (locked) return;
    supabase.rpc("get_quiz_questions", { p_course_id: course.id }).then(({ data, error }) => {
      if (!error && data) setQuestions(data.map(shuffleOptions));
      setLoading(false);
    });
  }, [locked]);

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined);

  async function submit() {
    setSubmitting(true);
    const assessmentResult = gradeAssessment(questions, answers, course.pass_threshold);
    const { graded, score, passed } = assessmentResult;

    setSubmitError("");
    const { data: attempt, error } = await supabase
      .from("quiz_attempts")
      .insert({
        user_id: userId, course_id: course.id, status: "completed",
        submitted_at: new Date().toISOString(), score, passed,
      })
      .select()
      .single();

    // The database refuses the attempt when no attempts are left (e.g. another tab used the last one).
    if (error || !attempt) {
      setSubmitError("Your attempt could not be saved. You may be out of attempts — refresh the page to check.");
      setSubmitting(false);
      return;
    }

    if (attempt) {
      await supabase.from("attempt_questions").insert(
        graded.map((g, index) => ({
          attempt_id: attempt.id,
          position: index,
          question_id: g.id,
          question_text: g.question_text,
          image_url: g.image_url,
          is_mandatory: g.is_mandatory,
          options: g.options,
          correct_index: g.correct_index,
          explanation: g.explanation,
          selected_index: g.selected_index,
          is_correct: g.is_correct,
        }))
      );
    }

    // The database issues the certificate when a passing attempt is saved.
    if (attempt && passed) {
      const { data: certificate } = await supabase.from("certificates").select("id").eq("user_id", userId).eq("course_id", course.id).maybeSingle();
      setCertificateId(certificate?.id || null);
    }

    setResult(assessmentResult);
    setSubmitting(false);
  }

  if (locked) return <LockedNotice course={course} />;

  if (loading) {
    return <AssessmentSkeleton showNav={false} />;
  }

  if (result) {
    return (
      <div className="assessment-page tp-fade-in">
        <div className="tp-label">{course.code} · Assessment results</div>
        <h1 className="tp-display" style={{ fontSize: 24, fontWeight: 700, margin: "6px 0 24px" }}>Results</h1>

        <div className={`tp-card assessment-result-card ${result.passed ? "is-passed" : "is-failed"}`}>
          <Dial pct={result.score} size={120} color={result.passed ? "var(--success)" : "var(--danger)"} label={`${result.score}%`} sub="score" />
          <div className="assessment-result-card__copy">
            <span className="tp-badge" style={{ background: result.passed ? "var(--success-dim)" : "var(--danger-dim)", color: result.passed ? "var(--success)" : "var(--danger)" }}>
              {result.passed ? "Passed" : "Not passed"}
            </span>
            <h2 className="tp-display">{result.passed ? "Course complete" : "Keep building your knowledge"}</h2>
            <div className="assessment-result-card__detail">
              {result.graded.filter((g) => g.is_correct).length} of {result.graded.length} correct · threshold {course.pass_threshold}%
            </div>
            <div className={`assessment-requirement ${result.mandatoryPassed ? "is-met" : "is-unmet"}`}>
              <strong>{result.mandatoryCount ? `Mandatory questions: ${result.mandatoryCorrectCount} of ${result.mandatoryCount} correct` : "No mandatory questions in this assessment"}</strong>
              <span>{result.mandatoryPassed ? "Requirement met" : "All mandatory questions must be correct to pass"}</span>
            </div>
            {result.passed && certificateId && (
              <div style={{ marginTop: 14 }}>
                <Link href={`/certificates/${certificateId}`} className="tp-btn tp-btn-primary" style={{ textDecoration: "none" }}>
                  View certificate
                </Link>
              </div>
            )}
            {!result.passed && attemptsLeft > 1 && (
              <div style={{ marginTop: 14 }}>
                <div className="assessment-result-card__detail" style={{ marginBottom: 8 }}>
                  {attemptsLeft - 1} of {MAX_ATTEMPTS} attempts left
                </div>
                <Link href={`/courses/${course.id}/quiz`} className="tp-btn tp-btn-primary" style={{ textDecoration: "none" }} onClick={() => window.location.reload()}>
                  Retake assessment
                </Link>
              </div>
            )}
            {!result.passed && attemptsLeft <= 1 && (
              <div className="assessment-result-card__detail" style={{ marginTop: 14 }}>
                You have used all {MAX_ATTEMPTS} attempts. Ask an admin to approve more attempts.
              </div>
            )}
          </div>
        </div>

        <div className="tp-label" style={{ marginBottom: 10 }}>Question review</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {result.graded.map((q, qi) => (
            <div key={q.id} className={`tp-card assessment-review-card ${q.is_correct ? "is-correct" : "is-wrong"}`}>
              <div style={{ display: "flex", gap: 10 }}>
                <span className="tp-mono" style={{ color: "var(--faint)", fontSize: 12 }}>{String(qi + 1).padStart(2, "0")}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, marginBottom: 8 }}>{q.question_text}</div>
                  {q.image_url && <img className="question-media question-media--review" src={q.image_url} alt="Reference for this question" />}
                  <div className="review-options">
                    {q.options.map((option, index) => {
                      const isCorrect = index === q.correct_index;
                      const isWrongSelection = index === q.selected_index && !q.is_correct;
                      return <div key={index} className={`review-option ${isCorrect ? "is-correct" : ""} ${isWrongSelection ? "is-wrong" : ""}`}><span>{option}</span>{isCorrect && <strong>Correct</strong>}{isWrongSelection && <strong>Your answer</strong>}</div>;
                    })}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--faint)", background: "var(--surface2)", padding: "8px 10px", borderRadius: 7, lineHeight: 1.5 }}>{q.explanation}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <Link href="/courses" className="tp-btn tp-btn-ghost back-link">← Back to courses</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="assessment-page tp-fade-in">
      <Link href="/courses" className="tp-btn tp-btn-ghost back-link">← Back to courses</Link>
      <header className="assessment-header">
        <div className="tp-label">{course.code} · Step 02</div>
        <div className="assessment-header__title">
          <h1 className="tp-display">Assessment</h1>
          <span className="tp-mono">{Object.keys(answers).length}/{questions.length} answered</span>
        </div>
        <div className="assessment-progress" aria-label={`${Object.keys(answers).length} of ${questions.length} questions answered`}>
          <span style={{ width: `${questions.length ? (Object.keys(answers).length / questions.length) * 100 : 0}%` }} />
        </div>
        <p>Choose the best answer for each question. You must meet the score threshold and answer every mandatory question correctly to pass. Attempts left: {attemptsLeft} of {MAX_ATTEMPTS}.</p>
      </header>

      <div className="assessment-list">
        {questions.map((q, qi) => (
          <section key={q.id} className="tp-card assessment-card" aria-labelledby={`question-${q.id}`}>
            <div className="assessment-question">
              <span className="assessment-question__number">{String(qi + 1).padStart(2, "0")}</span>
              <div>
                {q.is_mandatory && <span className="tp-badge question-mandatory-badge">Mandatory</span>}
                <h2 id={`question-${q.id}`}>{q.question_text}</h2>
              </div>
            </div>
            {q.image_url && <img className="question-media question-media--assessment" src={q.image_url} alt="Reference for this question" />}
            <div className="assessment-options" role="group" aria-labelledby={`question-${q.id}`}>
              {q.shuffled.map((opt) => (
                <button
                  type="button"
                  key={opt.origIdx}
                  className={`tp-opt ${answers[q.id] === opt.origIdx ? "sel" : ""}`}
                  aria-pressed={answers[q.id] === opt.origIdx}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt.origIdx }))}
                >
                  <span className="assessment-option__radio">{answers[q.id] === opt.origIdx && <i />}</span>
                  <span>{opt.text}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="assessment-submit">
        <button className="tp-btn tp-btn-primary" style={{ padding: "12px 26px" }} disabled={!allAnswered || submitting} onClick={submit}>
          {submitting ? "Submitting…" : allAnswered ? "Submit assessment" : `Answer all to submit (${questions.length - Object.keys(answers).length} left)`}
        </button>
        {submitError && <div role="alert" style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 10 }}>{submitError}</div>}
      </div>
    </div>
  );
}
