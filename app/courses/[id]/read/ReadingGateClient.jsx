"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PdfReader from "./PdfReader";

export default function ReadingGateClient({ course, userId }) {
  const supabase = createClient();
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [readingQuestions, setReadingQuestions] = useState([]);
  const [answeredIds, setAnsweredIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(undefined);
  const [answerChecked, setAnswerChecked] = useState(false);

  const total = course.read_seconds;
  const orderedQuestions = useMemo(() => [...readingQuestions].sort((a, b) => a.page_number - b.page_number), [readingQuestions]);
  const unanswered = orderedQuestions.find((q) => !answeredIds.includes(q.id));
  const done = elapsed >= total && answeredIds.length === readingQuestions.length;

  useEffect(() => {
    supabase.from("reading_sessions").insert({ user_id: userId, course_id: course.id }).select().single().then(({ data }) => setSessionId(data?.id));
    supabase.rpc("get_reading_questions", { p_course_id: course.id, p_count: 3 }).then(({ data }) => setReadingQuestions(data || []));
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

  const pct = Math.round((elapsed / total) * 100);
  return (
    <div className="tp-fade-in" style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px 40px" }}>
      <Link href="/courses" className="tp-btn tp-btn-ghost" style={{ marginBottom: 14, padding: "6px 12px", display: "inline-block", textDecoration: "none" }}>← Back to courses</Link>
      <div className="tp-label">{course.code} · Step 01</div>
      <h1 className="tp-display" style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 14px" }}>{course.title}</h1>

      <div className="tp-card reading-progress">
        <span className="tp-badge" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>{pct}% read</span>
        <span style={{ color: "var(--dim)" }}>{Math.max(0, total - elapsed)}s remaining</span>
        <span className="reading-progress__hint">Questions appear as you reach their PDF page.</span>
      </div>

      <div className="reading-workspace">
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span className="tp-label">PDF reader</span>
            <span style={{ fontSize: 12.5, color: "var(--dim)" }}>Viewing page {currentPage}</span>
          </div>
          <div className="tp-card" style={{ padding: 0, overflow: "hidden" }}>
            <PdfReader url={course.pdf_url} title={course.title} onPageChange={setCurrentPage} />
          </div>
        </section>

        <aside className="reading-question-panel">
          {activeQuestion ? <div className="tp-card tp-fade-in" style={{ padding: 20 }}><div className="tp-badge" style={{ background: "var(--warn-dim)", color: "var(--warn)", marginBottom: 12 }}>Reading question · page {activeQuestion.page_number}</div><div style={{ fontSize: 14.5, marginBottom: 16, lineHeight: 1.5 }}>{activeQuestion.question_text}</div><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{activeQuestion.options.map((option, index) => <button key={index} className={`tp-opt ${selectedAnswer === index ? "sel" : ""}`} disabled={answerChecked} onClick={() => setSelectedAnswer(index)} style={{ textAlign: "left" }}><span style={{ fontSize: 13.5 }}>{option}</span></button>)}</div>{answerChecked && <div style={{ fontSize: 12.5, lineHeight: 1.5, color: selectedAnswer === activeQuestion.correct_index ? "var(--accent)" : "var(--faint)", marginTop: 14 }}>{selectedAnswer === activeQuestion.correct_index ? "Correct. " : `Correct answer: ${activeQuestion.options[activeQuestion.correct_index]}. `}{activeQuestion.explanation}</div>}<div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><button className="tp-btn tp-btn-primary" disabled={selectedAnswer === undefined} onClick={() => answerChecked ? continueReading() : setAnswerChecked(true)}>{answerChecked ? "Continue reading" : "Check answer"}</button></div></div> : <div className="tp-card" style={{ padding: 20 }}><div className="tp-label" style={{ marginBottom: 8 }}>Reading questions</div><div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--dim)" }}>{readingQuestions.length ? "Keep scrolling through the PDF. The next question will appear when you reach its assigned page." : "No reading questions have been added for this course."}</div></div>}
        </aside>
      </div>

      <div className="reading-footer"><span style={{ color: "var(--faint)", fontSize: 12.5 }}>{answeredIds.length}/{readingQuestions.length} reading questions completed</span><button className="tp-btn tp-btn-primary" disabled={!done} onClick={proceed}>{done ? "Start assessment →" : elapsed < total ? `Continue reading… ${total - elapsed}s left` : `Complete ${readingQuestions.length - answeredIds.length} reading question${readingQuestions.length - answeredIds.length === 1 ? "" : "s"}`}</button></div>
      <style jsx>{`
        .reading-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; align-items: start; }
        .reading-question-panel { position: sticky; top: 18px; }
        @media (max-width: 820px) {
          .reading-workspace { grid-template-columns: 1fr; }
          .reading-question-panel { position: static; }
        }
      `}</style>
    </div>
  );
}
