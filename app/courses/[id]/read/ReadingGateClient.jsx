"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Skeleton from "@/components/Skeleton";
import PdfReader from "./PdfReader";

function shuffleOptions(question) {
  const shuffled = question.options.map((text, originalIndex) => ({ text, originalIndex }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return { ...question, shuffled };
}

export default function ReadingGateClient({ course, userId }) {
  const supabase = createClient();
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [readingQuestions, setReadingQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [answeredIds, setAnsweredIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(undefined);
  const [answerChecked, setAnswerChecked] = useState(false);

  const total = course.read_seconds;
  const orderedQuestions = useMemo(() => [...readingQuestions].sort((a, b) => a.page_number - b.page_number), [readingQuestions]);
  const unanswered = orderedQuestions.find((q) => !answeredIds.includes(q.id));
  const done = elapsed >= total && answeredIds.length === readingQuestions.length;
  const timeProgress = total ? Math.min(100, Math.round((elapsed / total) * 100)) : 100;
  const questionProgress = questionsLoading ? 0 : readingQuestions.length ? Math.round((answeredIds.length / readingQuestions.length) * 100) : 100;

  useEffect(() => {
    supabase.from("reading_sessions").select("id").eq("user_id", userId).eq("course_id", course.id).eq("checkpoint_passed", false).order("started_at", { ascending: false }).limit(1).maybeSingle().then(async ({ data }) => {
      if (data?.id) setSessionId(data.id);
      else {
        const { data: session } = await supabase.from("reading_sessions").insert({ user_id: userId, course_id: course.id }).select().single();
        setSessionId(session?.id);
      }
    });
    supabase.rpc("get_reading_questions", { p_course_id: course.id, p_count: 3 }).then(({ data }) => {
      setReadingQuestions((data || []).map(shuffleOptions));
      setQuestionsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (paused || elapsed >= total) return;
    const timer = setInterval(() => setElapsed((value) => Math.min(value + 1, total)), 1000);
    return () => clearInterval(timer);
  }, [paused, elapsed, total]);

  useEffect(() => {
    if (!activeQuestion && unanswered && currentPage >= unanswered.page_number) {
      setActiveQuestion(unanswered);
      setSelectedAnswer(undefined);
      setAnswerChecked(false);
      setPaused(true);
    }
  }, [activeQuestion, unanswered, currentPage]);

  async function proceed() {
    if (sessionId) await supabase.from("reading_sessions").update({ checkpoint_passed: true, completed_at: new Date().toISOString() }).eq("id", sessionId);
    router.push(`/courses/${course.id}/quiz`);
  }

  function continueReading() {
    if (!answerChecked) return;
    setAnsweredIds((ids) => [...ids, activeQuestion.id]);
    setActiveQuestion(null);
    setPaused(false);
  }

  return (
    <main className="reading-shell tp-fade-in">
      <Link href="/courses" className="tp-btn tp-btn-ghost back-link">← Back to courses</Link>
      <header className="reading-header">
        <div>
          <div className="tp-label">{course.code} · Step 01</div>
          <h1 className="tp-display">{course.title}</h1>
        </div>
        <div className="reading-header__step"><span>1</span> Reading <b>→</b> <span>2</span> Assessment</div>
      </header>

      <div className="reading-workspace">
        <section>
          <div className="reader-heading">
            <span className="tp-label">Course document</span>
            <span style={{ fontSize: 12, color: "var(--faint)", textAlign: "right" }}>Scroll to reach each reading checkpoint</span>
          </div>
          <div className="tp-card" style={{ padding: 0, overflow: "hidden" }}>
            <PdfReader url={course.pdf_url} title={course.title} onPageChange={setCurrentPage} />
          </div>
        </section>

        <aside className="reading-question-panel">
          <div className="tp-card reading-status-card">
            <div className="reading-status-card__heading">
              <div>
                <span className="tp-label">Your progress</span>
                <strong className="tp-display">{done ? "Ready" : paused ? "Checkpoint" : "Reading"}</strong>
              </div>
              <span className="reading-status-card__percent">{Math.round((timeProgress + questionProgress) / 2)}%</span>
            </div>
            <div className="reading-progress-row">
              <div><span>Reading time</span><b>{timeProgress}%</b></div>
              <div className="reading-progress-track"><span style={{ width: `${timeProgress}%` }} /></div>
            </div>
            <div className="reading-progress-row">
              <div><span>Checkpoints</span><b>{answeredIds.length}/{readingQuestions.length}</b></div>
              <div className="reading-progress-track"><span style={{ width: `${questionProgress}%` }} /></div>
            </div>
          </div>
          <div className="tp-card reading-question-card">
            {questionsLoading ? (
              <div className="reading-question-skeleton" aria-busy="true" aria-label="Loading reading questions">
                <Skeleton style={{ width: "72%", height: 12, marginBottom: 24 }} />
                <Skeleton style={{ width: 106, height: 21, borderRadius: 999, marginBottom: 14 }} />
                <Skeleton style={{ width: "95%", height: 42, marginBottom: 16 }} />
                <Skeleton style={{ width: "100%", height: 43, marginBottom: 8 }} />
                <Skeleton style={{ width: "100%", height: 43, marginBottom: 8 }} />
                <Skeleton style={{ width: "100%", height: 43 }} />
                <span className="tp-sr-only" role="status">Loading reading questions…</span>
              </div>
            ) : <>
            <div style={{ color: "var(--faint)", fontSize: 12, marginBottom: 12 }}>{answeredIds.length}/{readingQuestions.length} reading questions completed</div>
            {activeQuestion ? (
              <div className="tp-fade-in">
                <div className="tp-badge" style={{ background: "var(--warn-dim)", color: "var(--warn)", marginBottom: 12 }}>Reading question · page {activeQuestion.page_number}</div>
                <div style={{ fontSize: 14.5, marginBottom: 16, lineHeight: 1.5 }}>{activeQuestion.question_text}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeQuestion.shuffled.map((option) => {
                    const isCorrect = answerChecked && option.originalIndex === activeQuestion.correct_index;
                    const isWrong = answerChecked && selectedAnswer === option.originalIndex && !isCorrect;
                    return <button key={option.originalIndex} className={`tp-opt ${!answerChecked && selectedAnswer === option.originalIndex ? "sel" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}`} disabled={answerChecked} onClick={() => setSelectedAnswer(option.originalIndex)} style={{ textAlign: "left" }}><span style={{ fontSize: 13.5 }}>{option.text}</span>{isCorrect && <span className="answer-mark">✓</span>}{isWrong && <span className="answer-mark">×</span>}</button>;
                  })}
                </div>
                {answerChecked && <div className={selectedAnswer === activeQuestion.correct_index ? "answer-feedback is-correct" : "answer-feedback is-wrong"}>{selectedAnswer === activeQuestion.correct_index ? "Correct. " : "That answer is incorrect. "}{activeQuestion.explanation}</div>}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><button className="tp-btn tp-btn-primary" disabled={selectedAnswer === undefined} onClick={() => answerChecked ? continueReading() : setAnswerChecked(true)}>{answerChecked ? "Continue reading" : "Check answer"}</button></div>
              </div>
            ) : answeredIds.length === readingQuestions.length && readingQuestions.length > 0 ? (
              <div className="reading-question-complete tp-fade-in"><div className="reading-question-complete__icon">✓</div><div className="tp-display">Reading questions completed</div><p>You answered all {readingQuestions.length} reading checkpoints.</p></div>
            ) : (
              <div className="tp-fade-in"><div className="tp-label" style={{ marginBottom: 8 }}>Reading questions</div><div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--dim)" }}>{readingQuestions.length ? "Keep scrolling through the PDF. This panel will change when you reach the next question." : "No reading questions have been added for this course."}</div></div>
            )}
            </>}
          </div>
        </aside>
      </div>

      <div className="reading-footer">
        <span>{done ? "All requirements complete" : "Complete the reading requirements to unlock your assessment."}</span>
        <button className="tp-btn tp-btn-primary" disabled={!done} onClick={proceed}>{done ? "Start assessment →" : elapsed < total ? `Continue reading · ${total - elapsed}s left` : `Complete ${readingQuestions.length - answeredIds.length} checkpoint${readingQuestions.length - answeredIds.length === 1 ? "" : "s"}`}</button>
      </div>
      <style jsx>{`
        .reading-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; align-items: start; }
        .reading-question-panel { position: sticky; top: 88px; display: flex; flex-direction: column; gap: 12px; }
        .reading-question-card { padding: 20px; min-height: 190px; }
        @media (max-width: 1100px) {
          .reading-workspace { grid-template-columns: 1fr; }
          .reading-question-panel { position: static; }
        }
      `}</style>
    </main>
  );
}
