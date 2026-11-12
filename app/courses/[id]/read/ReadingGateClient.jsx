"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BackToCourses from "@/components/BackToCourses";
import BigTick from "@/components/BigTick";
import { shuffleOptions } from "@/lib/assessment";
import { startReading } from "@/lib/queries";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";
import CheckpointCard from "./CheckpointCard";
import PdfReader from "./PdfReader";
import ReadingProgressCard from "./ReadingProgressCard";

const plural = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;
// 75 → "1 min 15 s"; under a minute → "40 s".
const formatTimeLeft = (seconds) => (seconds >= 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : `${seconds} s`);

// The database picks the checkpoint questions, checks each answer and decides when the reading
// is finished (migration 011), so the browser never sees the correct answers.
export default function ReadingGateClient({ course, materials }) {
  const [supabase] = useState(createClient);
  const router = useRouter();
  const startedRef = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [readingQuestions, setReadingQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [answeredIds, setAnsweredIds] = useState([]);
  // Furthest page reached in the open deck; checkpoints open when the reader gets to them.
  const [furthestPage, setFurthestPage] = useState(1);
  const [deckIndex, setDeckIndex] = useState(0);
  const [openedDecks, setOpenedDecks] = useState([0]);
  const [selectedAnswer, setSelectedAnswer] = useState(undefined);
  // The database's verdict on the selected answer: { correct, explanation }, or null.
  const [feedback, setFeedback] = useState(null);
  const [checking, setChecking] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [progressError, setProgressError] = useState("");
  // Saving can be retried, unlike failing to load the session or checkpoints.
  const [saveError, setSaveError] = useState("");

  const total = course.read_seconds;
  const viewOnly = course.view_only;
  const deck = materials[deckIndex];
  const multiDeck = materials.length > 1;
  const unopenedDecks = materials.length - openedDecks.length;
  const timeUp = elapsed >= total;
  const remainingQuestions = readingQuestions.length - answeredIds.length;
  const orderedQuestions = useMemo(() => [...readingQuestions].sort((a, b) => a.page_number - b.page_number), [readingQuestions]);
  // The next checkpoint is the earliest unanswered one in the deck being read.
  const unanswered = orderedQuestions.find((question) => question.material_id === deck?.id && !answeredIds.includes(question.id));
  // The checkpoint stays open until answered, even if the reader scrolls back.
  const activeQuestion = unanswered && furthestPage >= unanswered.page_number ? unanswered : null;
  const paused = Boolean(activeQuestion);
  const done = timeUp && remainingQuestions === 0 && unopenedDecks === 0;
  const timeProgress = total ? Math.min(100, Math.round((elapsed / total) * 100)) : 100;
  const questionProgress = questionsLoading ? 0 : readingQuestions.length ? Math.round((answeredIds.length / readingQuestions.length) * 100) : 100;

  // Once per mount: a ref, unlike state, survives React Strict Mode's second effect run.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startReading(supabase, course.id)
      .then((data) => {
        setSessionId(data.session_id);
        setReadingQuestions(data.questions.map((question) => shuffleOptions(question)));
        setAnsweredIds(data.questions.filter((question) => question.answered).map((question) => question.id));
      })
      .catch(() => setProgressError("We couldn’t start your reading session. Refresh the page to try again."))
      .finally(() => setQuestionsLoading(false));
  }, [supabase, course.id]);

  useEffect(() => {
    if (paused || timeUp) return;
    const timer = setInterval(() => setElapsed((value) => Math.min(value + 1, total)), 1000);
    return () => clearInterval(timer);
  }, [paused, timeUp, total]);

  function openDeck(index) {
    if (index === deckIndex || activeQuestion) return;
    setDeckIndex(index);
    setFurthestPage(1);
    setOpenedDecks((opened) => (opened.includes(index) ? opened : [...opened, index]));
  }

  async function proceed() {
    if (!sessionId || completing) return;
    setCompleting(true);
    setSaveError("");
    const { data, error } = await supabase.rpc("finish_reading", { p_session_id: sessionId });
    if (error) {
      setSaveError(/minimum reading time/i.test(error.message) ? "The minimum reading time isn’t complete yet. Keep reading, then try again." : "We couldn’t save your reading progress. Please try again.");
      setCompleting(false);
      return;
    }
    if (!viewOnly) {
      router.push(routes.quiz(course.id));
      return;
    }
    // The database issues the certificate when the reading of a reading-only course is finished.
    router.push(data?.certificate_id ? routes.certificate(data.certificate_id) : routes.courses);
    router.refresh();
  }

  async function handleAnswerAction() {
    if (!feedback) {
      setChecking(true);
      const { data, error } = await supabase.rpc("answer_reading_question", { p_session_id: sessionId, p_question_id: activeQuestion.id, p_selected_index: selectedAnswer });
      setChecking(false);
      if (error) {
        setSaveError("We couldn’t check your answer. Please try again.");
        return;
      }
      setSaveError("");
      setFeedback(data);
      return;
    }
    if (feedback.correct) setAnsweredIds((ids) => [...ids, activeQuestion.id]);
    setSelectedAnswer(undefined);
    setFeedback(null);
  }

  function questionLocation(question) {
    const deckNumber = materials.findIndex((material) => material.id === question.material_id) + 1;
    return `${multiDeck ? `deck ${deckNumber}, ` : ""}page ${question.page_number}`;
  }

  function footerLabel() {
    if (completing) return "Saving progress…";
    if (done) return viewOnly ? "Finish and get certificate →" : "Start assessment →";
    if (paused) return "Answer the reading question to continue";
    if (!timeUp) return `Keep reading · ${formatTimeLeft(total - elapsed)} left`;
    if (remainingQuestions > 0) return `Answer ${plural(remainingQuestions, "more reading question")}`;
    return `Open ${plural(unopenedDecks, "more deck")}`;
  }

  const footerMessage = progressError || saveError || (done
    ? "Reading complete"
    : `Finish the reading to ${viewOnly ? "get your certificate" : "unlock the assessment"}.`);

  return (
    <main className="reading-shell tp-fade-in">
      <BackToCourses />
      <header className="reading-header">
        <div>
          <div className="tp-label">{course.code} · {viewOnly ? "Reading only" : "Step 1 of 2"}</div>
          <h1 className="tp-display">{course.title}</h1>
        </div>
        <div className="reading-header__step"><span>1</span> Reading <b>→</b> <span>2</span> {viewOnly ? "Certificate" : "Assessment"}</div>
      </header>

      <div className="reading-workspace">
        <section>
          <div className="reader-heading">
            <span className="tp-label">{multiDeck ? `Course documents · ${materials.length} decks` : "Course document"}</span>
            <span className="reader-heading__hint">
              {multiDeck ? "Open and read every deck" : "Scroll down to read the whole document"}
              {readingQuestions.length > 0 && " · questions appear as you read"}
            </span>
          </div>
          {multiDeck && (
            <div className="deck-tabs" role="group" aria-label="Course decks">
              {materials.map((material, index) => (
                <button
                  key={material.id}
                  type="button"
                  aria-current={index === deckIndex ? "true" : undefined}
                  className={index === deckIndex ? "deck-tab is-active" : "deck-tab"}
                  disabled={Boolean(activeQuestion) && index !== deckIndex}
                  title={activeQuestion ? "Answer the reading question first" : material.title}
                  onClick={() => openDeck(index)}
                >
                  <span className="deck-tab__number">{openedDecks.includes(index) && index !== deckIndex ? "✓" : index + 1}</span>
                  <span className="deck-tab__title">{material.title}</span>
                </button>
              ))}
            </div>
          )}
          <div className="tp-card reader-frame">
            <PdfReader key={deck?.id || "none"} url={deck?.pdf_url} title={deck?.title || course.title} onPageChange={(page) => setFurthestPage((furthest) => Math.max(furthest, page))} />
          </div>
          {multiDeck && deckIndex < materials.length - 1 && (
            <div className="deck-next">
              <button type="button" className="tp-btn tp-btn-ghost" disabled={Boolean(activeQuestion)} onClick={() => openDeck(deckIndex + 1)}>
                Next deck: {materials[deckIndex + 1].title} →
              </button>
            </div>
          )}
        </section>

        <aside className="reading-question-panel">
          <ReadingProgressCard
            status={done ? "Reading complete" : paused ? "Answer the question" : "Reading"}
            timeProgress={timeProgress}
            questionProgress={questionProgress}
            answeredCount={answeredIds.length}
            questionCount={readingQuestions.length}
            decks={multiDeck ? { opened: openedDecks.length, total: materials.length } : null}
          />
          <CheckpointCard
            loading={questionsLoading}
            questionCount={readingQuestions.length}
            answeredCount={answeredIds.length}
            multiDeck={multiDeck}
            activeQuestion={activeQuestion}
            location={activeQuestion ? questionLocation(activeQuestion) : ""}
            selectedAnswer={selectedAnswer}
            feedback={feedback}
            checking={checking}
            onSelect={setSelectedAnswer}
            onAction={handleAnswerAction}
          />
        </aside>
      </div>

      <div className="reading-footer">
        {done && !progressError && !saveError
          ? <span className="reading-footer__done"><BigTick size={40} label="Reading complete" /> {footerMessage}</span>
          : <span>{footerMessage}</span>}
        <button type="button" className="tp-btn tp-btn-primary" disabled={!done || !sessionId || completing || Boolean(progressError)} onClick={proceed}>
          {footerLabel()}
        </button>
      </div>
    </main>
  );
}
