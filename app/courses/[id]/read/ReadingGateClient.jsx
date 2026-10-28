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

export default function ReadingGateClient({ course, materials, userId }) {
  const supabase = createClient();
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [readingQuestions, setReadingQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [answeredIds, setAnsweredIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [deckIndex, setDeckIndex] = useState(0);
  const [openedDecks, setOpenedDecks] = useState([0]);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(undefined);
  const [answerChecked, setAnswerChecked] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [progressError, setProgressError] = useState("");

  const total = course.read_seconds;
  const deck = materials[deckIndex];
  const multiDeck = materials.length > 1;
  const deckNumber = (materialId) => materials.findIndex((material) => material.id === materialId) + 1;
  const unopenedDecks = materials.length - openedDecks.length;
  const orderedQuestions = useMemo(() => [...readingQuestions].sort((a, b) => a.page_number - b.page_number), [readingQuestions]);
  // The next checkpoint is the earliest unanswered one in the deck being read.
  const unanswered = orderedQuestions.find((q) => q.material_id === deck?.id && !answeredIds.includes(q.id));
  const done = elapsed >= total && answeredIds.length === readingQuestions.length && unopenedDecks === 0;
  const timeProgress = total ? Math.min(100, Math.round((elapsed / total) * 100)) : 100;
  const questionProgress = questionsLoading ? 0 : readingQuestions.length ? Math.round((answeredIds.length / readingQuestions.length) * 100) : 100;
  const answerIsCorrect = selectedAnswer === activeQuestion?.correct_index;

  useEffect(() => {
    supabase.from("reading_sessions").select("id").eq("user_id", userId).eq("course_id", course.id).eq("checkpoint_passed", false).order("started_at", { ascending: false }).limit(1).maybeSingle().then(async ({ data, error }) => {
      if (error) {
        setProgressError("We couldn’t start your reading session. Refresh the page to try again.");
        return;
      }
      if (data?.id) setSessionId(data.id);
      else {
        const { data: session, error: insertError } = await supabase.from("reading_sessions").insert({ user_id: userId, course_id: course.id }).select().single();
        if (insertError) {
          setProgressError("We couldn’t start your reading session. Refresh the page to try again.");
          return;
        }
        setSessionId(session?.id);
      }
    });
    supabase.rpc("get_reading_questions", { p_course_id: course.id, p_count: 3 }).then(({ data, error }) => {
      if (error) setProgressError("We couldn’t load the reading checkpoints. Refresh the page to try again.");
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

  function openDeck(index) {
    if (index === deckIndex || activeQuestion) return;
    setDeckIndex(index);
    setCurrentPage(1);
    setOpenedDecks((opened) => (opened.includes(index) ? opened : [...opened, index]));
  }

  async function proceed() {
    if (!sessionId || completing) return;
    setCompleting(true);
    setProgressError("");
    const { error } = await supabase.from("reading_sessions").update({ checkpoint_passed: true, completed_at: new Date().toISOString() }).eq("id", sessionId);
    if (error) {
      setProgressError("We couldn’t save your reading progress. Please try again.");
      setCompleting(false);
      return;
    }
    router.push(`/courses/${course.id}/quiz`);
  }

  function continueReading() {
    if (!answerChecked || selectedAnswer !== activeQuestion.correct_index) return;
    setAnsweredIds((ids) => [...ids, activeQuestion.id]);
    setActiveQuestion(null);
    setPaused(false);
  }

  function retryQuestion() {
    setSelectedAnswer(undefined);
    setAnswerChecked(false);
  }

  function handleAnswerAction() {
    if (!answerChecked) setAnswerChecked(true);
    else if (answerIsCorrect) continueReading();
    else retryQuestion();
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
            <span className="tp-label">{multiDeck ? `Course documents · ${materials.length} decks` : "Course document"}</span>
            <span style={{ fontSize: 12, color: "var(--faint)", textAlign: "right" }}>{multiDeck ? "Read every deck and reach each reading checkpoint" : "Scroll to reach each reading checkpoint"}</span>
          </div>
          {multiDeck && (
            <div className="deck-tabs" role="tablist" aria-label="Course decks">
              {materials.map((material, index) => (
                <button key={material.id} type="button" role="tab" aria-selected={index === deckIndex} className={`deck-tab ${index === deckIndex ? "is-active" : ""}`} disabled={Boolean(activeQuestion) && index !== deckIndex} title={activeQuestion ? "Answer the reading question first" : material.title} onClick={() => openDeck(index)}>
                  <span className="deck-tab__number">{openedDecks.includes(index) && index !== deckIndex ? "✓" : index + 1}</span>
                  <span className="deck-tab__title">{material.title}</span>
                </button>
              ))}
            </div>
          )}
          <div className="tp-card" style={{ padding: 0, overflow: "hidden" }}>
            <PdfReader key={deck?.id || "none"} url={deck?.pdf_url} title={deck?.title || course.title} onPageChange={setCurrentPage} />
          </div>
          {multiDeck && deckIndex < materials.length - 1 && (
            <div className="deck-next"><button type="button" className="tp-btn tp-btn-ghost" disabled={Boolean(activeQuestion)} onClick={() => openDeck(deckIndex + 1)}>Next deck: {materials[deckIndex + 1].title} →</button></div>
          )}
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
            {multiDeck && (
              <div className="reading-progress-row">
                <div><span>Decks opened</span><b>{openedDecks.length}/{materials.length}</b></div>
                <div className="reading-progress-track"><span style={{ width: `${Math.round((openedDecks.length / materials.length) * 100)}%` }} /></div>
              </div>
            )}
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
                <div className="tp-badge" style={{ background: "var(--warn-dim)", color: "var(--warn)", marginBottom: 12 }}>Reading question · {multiDeck ? `deck ${deckNumber(activeQuestion.material_id)}, ` : ""}page {activeQuestion.page_number}</div>
                <div style={{ fontSize: 14.5, marginBottom: 16, lineHeight: 1.5 }}>{activeQuestion.question_text}</div>
                {activeQuestion.image_url && <img className="question-media question-media--reading" src={activeQuestion.image_url} alt="Reference for this question" />}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeQuestion.shuffled.map((option) => {
                    const isCorrect = answerChecked && option.originalIndex === activeQuestion.correct_index;
                    const isWrong = answerChecked && selectedAnswer === option.originalIndex && !isCorrect;
                    return <button key={option.originalIndex} className={`tp-opt ${!answerChecked && selectedAnswer === option.originalIndex ? "sel" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}`} disabled={answerChecked} onClick={() => setSelectedAnswer(option.originalIndex)} style={{ textAlign: "left" }}><span style={{ fontSize: 13.5 }}>{option.text}</span>{isCorrect && <span className="answer-mark">✓</span>}{isWrong && <span className="answer-mark">×</span>}</button>;
                  })}
                </div>
                {answerChecked && <div className={selectedAnswer === activeQuestion.correct_index ? "answer-feedback is-correct" : "answer-feedback is-wrong"}>{selectedAnswer === activeQuestion.correct_index ? "Correct. " : "That answer is incorrect. "}{activeQuestion.explanation}</div>}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><button className="tp-btn tp-btn-primary" disabled={selectedAnswer === undefined} onClick={handleAnswerAction}>{answerChecked ? answerIsCorrect ? "Continue reading" : "Try again" : "Check answer"}</button></div>
              </div>
            ) : answeredIds.length === readingQuestions.length && readingQuestions.length > 0 ? (
              <div className="reading-question-complete tp-fade-in"><div className="reading-question-complete__icon">✓</div><div className="tp-display">Reading questions completed</div><p>You answered all {readingQuestions.length} reading checkpoints.</p></div>
            ) : (
              <div className="tp-fade-in"><div className="tp-label" style={{ marginBottom: 8 }}>Reading questions</div><div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--dim)" }}>{readingQuestions.length ? (multiDeck ? "Keep reading through each deck. This panel will change when you reach the next question." : "Keep scrolling through the PDF. This panel will change when you reach the next question.") : "No reading questions have been added for this course."}</div></div>
            )}
            </>}
          </div>
        </aside>
      </div>

      <div className="reading-footer">
        <span>{progressError || (done ? "All requirements complete" : "Complete the reading requirements to unlock your assessment.")}</span>
        <button className="tp-btn tp-btn-primary" disabled={!done || !sessionId || completing || Boolean(progressError)} onClick={proceed}>{completing ? "Saving progress…" : done ? "Start assessment →" : elapsed < total ? `Continue reading · ${total - elapsed}s left` : answeredIds.length < readingQuestions.length ? `Complete ${readingQuestions.length - answeredIds.length} checkpoint${readingQuestions.length - answeredIds.length === 1 ? "" : "s"}` : `Open ${unopenedDecks} more deck${unopenedDecks === 1 ? "" : "s"}`}</button>
      </div>
      <style jsx>{`
        .reading-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; align-items: start; }
        .reading-question-panel { position: sticky; top: 88px; display: flex; flex-direction: column; gap: 12px; }
        .reading-question-card { padding: 20px; min-height: 190px; }
        .deck-tabs { display: flex; gap: 6px; margin-bottom: 10px; overflow-x: auto; padding-bottom: 2px; }
        .deck-tab { min-width: 0; max-width: 240px; display: flex; align-items: center; gap: 8px; padding: 7px 12px 7px 7px; border: 1px solid var(--border); border-radius: 8px; background: var(--card); color: var(--dim); font-size: 12.5px; cursor: pointer; flex: 0 0 auto; }
        .deck-tab:disabled { cursor: not-allowed; opacity: .55; }
        .deck-tab.is-active { border-color: var(--accent); color: var(--text); box-shadow: 0 0 0 1px var(--accent) inset; }
        .deck-tab__number { width: 22px; height: 22px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 6px; background: var(--accent-dim); color: var(--accent); font: 600 11px/1 'JetBrains Mono', monospace; }
        .deck-tab__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .deck-next { display: flex; justify-content: flex-end; margin-top: 10px; }
        @media (max-width: 1100px) {
          .reading-workspace { grid-template-columns: 1fr; }
          .reading-question-panel { position: static; }
        }
      `}</style>
    </main>
  );
}
