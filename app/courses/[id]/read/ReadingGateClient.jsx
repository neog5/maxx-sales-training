"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BackToCourses from "@/components/BackToCourses";
import BigTick from "@/components/BigTick";
import { shuffleOptions } from "@/lib/assessment";
import { formatMinutes } from "@/lib/format";
import { isVideo } from "@/lib/course-materials";
import { startReading } from "@/lib/queries";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";
import CheckpointCard from "./CheckpointCard";
import PdfReader from "./PdfReader";
import ReadingProgressCard from "./ReadingProgressCard";
import VideoReader from "./VideoReader";

const plural = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;
// What the learner has to do, shown above the reader.
function readingHint(materials) {
  const videoCount = materials.filter(isVideo).length;
  const deckCount = materials.length - videoCount;
  if (!videoCount) return deckCount > 1 ? "Open and read every deck" : "Scroll down to read the whole document";
  if (!deckCount) return videoCount > 1 ? "Open and watch every video" : "Watch the video below";
  return "Read every deck and open every video";
}

// The database picks the checkpoint questions, checks each answer and decides when the reading
// is finished (migrations 011, 014 and 018), so the browser never sees the correct answers.
// Materials are PDF decks and videos. Videos have no checkpoints and no minimum time: each
// one counts as soon as it's opened (the database records it, so a reload keeps it).
// Each PDF deck has its own minimum reading time (course.read_seconds), counted while that deck
// is open. The clock keeps running while a reading question is waiting for an answer.
// `review` is set once the learner has finished the material: the page is then for looking
// back at it, with no new session, timer or questions.
export default function ReadingGateClient({ course, materials, review = false, certificateId = null }) {
  const [supabase] = useState(createClient);
  const router = useRouter();
  const startedRef = useRef(false);
  const sectionRef = useRef(null);
  // Seconds spent on each PDF deck, by material id.
  const [deckSeconds, setDeckSeconds] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [readingQuestions, setReadingQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(!review);
  const [answeredIds, setAnsweredIds] = useState([]);
  // Furthest page reached in the open deck; checkpoints open when the reader gets to them.
  const [furthestPage, setFurthestPage] = useState(1);
  const [deckIndex, setDeckIndex] = useState(0);
  const [openedDecks, setOpenedDecks] = useState([0]);
  // Ids of the videos opened, as recorded by the database.
  const [openedVideos, setOpenedVideos] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(undefined);
  // The database's verdict on the selected answer: { correct, explanation }, or null.
  const [feedback, setFeedback] = useState(null);
  const [checking, setChecking] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [progressError, setProgressError] = useState("");
  // Saving can be retried, unlike failing to load the session or checkpoints.
  const [saveError, setSaveError] = useState("");

  const perDeck = course.read_seconds;
  const videos = materials.filter(isVideo);
  const pdfDecks = materials.map((material, index) => ({ material, index })).filter(({ material }) => !isVideo(material));
  const viewOnly = course.view_only;
  const deck = materials[deckIndex];
  const onPdf = Boolean(deck) && !isVideo(deck);
  const multiDeck = materials.length > 1;
  const multiPdf = pdfDecks.length > 1;
  const timeOn = (material) => Math.min(deckSeconds[material.id] || 0, perDeck);
  // A deck is read once it has been opened and has had its minimum time.
  const decksRead = pdfDecks.filter(({ material, index }) => openedDecks.includes(index) && timeOn(material) >= perDeck).length;
  const decksLeft = pdfDecks.length - decksRead;
  const deckTimeLeft = onPdf ? perDeck - timeOn(deck) : 0;
  const timing = !review && deckTimeLeft > 0;
  const unopenedVideos = videos.filter((video) => !openedVideos.includes(video.id)).length;
  const remainingQuestions = readingQuestions.length - answeredIds.length;
  // Reading left to do apart from opening videos: deck time, checkpoints and unread decks.
  const readingLeft = decksLeft > 0 || remainingQuestions > 0;
  const orderedQuestions = useMemo(() => [...readingQuestions].sort((a, b) => a.page_number - b.page_number), [readingQuestions]);
  // The next checkpoint is the earliest unanswered one in the deck being read.
  const unanswered = orderedQuestions.find((question) => question.material_id === deck?.id && !answeredIds.includes(question.id));
  // The checkpoint stays open until answered, even if the reader scrolls back.
  const activeQuestion = unanswered && furthestPage >= unanswered.page_number ? unanswered : null;
  const done = decksLeft === 0 && remainingQuestions === 0 && unopenedVideos === 0;
  const questionProgress = questionsLoading ? 0 : readingQuestions.length ? Math.round((answeredIds.length / readingQuestions.length) * 100) : 100;

  // Saves that a video was opened (mark_video_watched, migration 014). A failure can be
  // retried by refreshing the page.
  async function recordVideoOpened(session, material) {
    const { data, error } = await supabase.rpc("mark_video_watched", { p_session_id: session, p_material_id: material.id });
    if (error) {
      setSaveError("We couldn’t save that you opened this video. Refresh the page to try again.");
      return;
    }
    setSaveError("");
    setOpenedVideos(data.watched_videos || []);
  }

  // Once per mount: a ref, unlike state, survives React Strict Mode's second effect run.
  useEffect(() => {
    if (review || startedRef.current) return;
    startedRef.current = true;
    startReading(supabase, course.id)
      .then((data) => {
        setSessionId(data.session_id);
        setReadingQuestions(data.questions.map((question) => shuffleOptions(question)));
        setAnsweredIds(data.questions.filter((question) => question.answered).map((question) => question.id));
        const opened = data.watched_videos || [];
        setOpenedVideos(opened);
        // The first material is open from the start, so a video there counts right away.
        if (isVideo(materials[0]) && !opened.includes(materials[0].id)) recordVideoOpened(data.session_id, materials[0]);
      })
      .catch(() => setProgressError("We couldn’t start your session. Refresh the page to try again."))
      .finally(() => setQuestionsLoading(false));
    // Runs once per mount; recordVideoOpened only uses values fixed for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, course.id, review]);

  // Counts time on the open deck until it has had its minimum.
  const timedDeckId = timing ? deck.id : null;
  useEffect(() => {
    if (!timedDeckId) return;
    const timer = setInterval(() => setDeckSeconds((seconds) => ({ ...seconds, [timedDeckId]: Math.min((seconds[timedDeckId] || 0) + 1, perDeck) })), 1000);
    return () => clearInterval(timer);
  }, [timedDeckId, perDeck]);

  function openDeck(index) {
    if (index === deckIndex || activeQuestion) return;
    setDeckIndex(index);
    setFurthestPage(1);
    setOpenedDecks((opened) => (opened.includes(index) ? opened : [...opened, index]));
    if (!review && isVideo(materials[index]) && sessionId && !openedVideos.includes(materials[index].id)) recordVideoOpened(sessionId, materials[index]);
  }

  // Previous / Next sit below the reader, so bring the new material's top back into view.
  function goTo(index) {
    openDeck(index);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function proceed() {
    if (!sessionId || completing) return;
    setCompleting(true);
    setSaveError("");
    const { data, error } = await supabase.rpc("finish_reading", { p_session_id: sessionId });
    if (error) {
      setSaveError(/minimum reading time/i.test(error.message) ? "The minimum reading time for the decks isn’t complete yet. Keep reading, then try again."
        : /watch every video/i.test(error.message) ? "Open every video, then try again."
        : "We couldn’t save your progress. Please try again.");
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

  const timeLeftLabel = timing ? `${formatMinutes(deckTimeLeft)} left${multiPdf ? " on this deck" : ""}` : "";

  function footerLabel() {
    if (completing) return "Saving progress…";
    if (done) return viewOnly ? "Finish and get certificate →" : "Start assessment →";
    if (activeQuestion) return "Answer the reading question to continue";
    if (timing) return `Keep reading · ${timeLeftLabel}`;
    if (remainingQuestions > 0) return `Answer ${plural(remainingQuestions, "more reading question")}`;
    if (decksLeft > 0) return `Read ${plural(decksLeft, "more deck")} · ${formatMinutes(perDeck)} each`;
    return `Open ${plural(unopenedVideos, "more video")}`;
  }

  // What's still left, in words: deck work (time, checkpoints, decks), videos to open, or both.
  function pendingMessage() {
    const goal = viewOnly ? "get your certificate" : "unlock the assessment";
    if (readingLeft && unopenedVideos > 0) return `Finish the decks and open every video to ${goal}.`;
    if (unopenedVideos > 0) return `Open ${videos.length === 1 ? "the video" : plural(unopenedVideos, "more video")} to ${goal}.`;
    return `Finish the course material to ${goal}.`;
  }

  const footerMessage = progressError || saveError || (done ? "Course material complete" : pendingMessage());

  const checkpointCard = (
    <CheckpointCard
      loading={questionsLoading}
      questionCount={readingQuestions.length}
      answeredCount={answeredIds.length}
      activeQuestion={activeQuestion}
      location={activeQuestion ? questionLocation(activeQuestion) : ""}
      selectedAnswer={selectedAnswer}
      feedback={feedback}
      checking={checking}
      onSelect={setSelectedAnswer}
      onAction={handleAnswerAction}
    />
  );

  // Where a finished course's review page leads: the certificate, or the assessment.
  const reviewNext = certificateId
    ? { href: routes.certificate(certificateId), label: "View certificate →" }
    : !viewOnly ? { href: routes.quiz(course.id), label: "Go to assessment →" } : { href: routes.courses, label: "Back to courses" };

  return (
    <main className="reading-shell tp-fade-in">
      <BackToCourses />
      <header className="reading-header">
        <div>
          <h1 className="tp-display">{course.title}</h1>
        </div>
        {!review && <div className="reading-header__step"><span>1</span> Course material <b>→</b> <span>2</span> {viewOnly ? "Certificate" : "Assessment"}</div>}
      </header>

      <div className={`reading-workspace${review ? " is-review" : ""}`}>
        <section ref={sectionRef}>
          <div className="reader-heading">
            <span className="reader-heading__hint">
              {review ? "You’ve finished this course material. Look back over it any time." : readingHint(materials)}
              {!review && readingQuestions.length > 0 && " · questions appear as you read"}
            </span>
          </div>
          {multiDeck && (
            <div className="deck-tabs" role="group" aria-label="Course materials">
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
                  {!review && index !== deckIndex && (isVideo(material) ? openedVideos.includes(material.id) : openedDecks.includes(index) && timeOn(material) >= perDeck)
                    ? <span className="deck-tab__number is-done" aria-label="Done">✓</span>
                    : <span className="deck-tab__number">{index + 1}</span>}
                  <span className="deck-tab__title">{material.title}</span>
                </button>
              ))}
            </div>
          )}
          <div className="tp-card reader-frame">
            {isVideo(deck)
              ? <VideoReader key={deck.id} url={deck.video_url} title={deck.title} />
              : (
                <PdfReader
                  key={deck?.id || "none"}
                  url={deck?.pdf_url}
                  title={deck?.title || course.title}
                  onPageChange={(page) => setFurthestPage((furthest) => Math.max(furthest, page))}
                  fullscreenStatus={activeQuestion ? "Reading question" : timeLeftLabel}
                  fullscreenPanel={activeQuestion ? checkpointCard : null}
                />
              )}
          </div>
          {multiDeck && (
            <nav className="deck-nav" aria-label="Move between course materials">
              <button type="button" className="tp-btn tp-btn-ghost" disabled={deckIndex === 0 || Boolean(activeQuestion)} onClick={() => goTo(deckIndex - 1)}>
                ← Previous
              </button>
              <span className="deck-nav__count">{deckIndex + 1} of {materials.length}</span>
              {deckIndex < materials.length - 1
                ? (
                  <button type="button" className="tp-btn tp-btn-primary deck-nav__next" disabled={Boolean(activeQuestion)} title={materials[deckIndex + 1].title} onClick={() => goTo(deckIndex + 1)}>
                    <span className="deck-nav__next-title">Next: {materials[deckIndex + 1].title}</span> →
                  </button>
                )
                : <span className="deck-nav__last">Last one</span>}
            </nav>
          )}
        </section>

        {!review && (
          <aside className="reading-question-panel">
            <ReadingProgressCard
              status={done ? "Complete" : activeQuestion ? "Answer the question" : "In progress"}
              time={onPdf && perDeck > 0 ? { label: multiPdf ? "Reading time · this deck" : "Reading time", left: deckTimeLeft, percent: Math.round((timeOn(deck) / perDeck) * 100) } : null}
              timePercent={pdfDecks.length && perDeck > 0 ? Math.round(pdfDecks.reduce((sum, { material }) => sum + timeOn(material) / perDeck, 0) / pdfDecks.length * 100) : null}
              questionProgress={questionProgress}
              answeredCount={answeredIds.length}
              questionCount={readingQuestions.length}
              decks={multiPdf ? { read: decksRead, total: pdfDecks.length } : null}
              videos={videos.length ? { opened: videos.length - unopenedVideos, total: videos.length } : null}
            />
            {checkpointCard}
          </aside>
        )}
      </div>

      <div className="reading-footer">
        {review ? (
          <>
            <span className="reading-footer__done"><BigTick size={40} label="Course material complete" /> Course material complete</span>
            <button type="button" className="tp-btn tp-btn-primary" onClick={() => router.push(reviewNext.href)}>{reviewNext.label}</button>
          </>
        ) : (
          <>
            {done && !progressError && !saveError
              ? <span className="reading-footer__done"><BigTick size={40} label="Course material complete" /> {footerMessage}</span>
              : <span>{footerMessage}</span>}
            <button type="button" className="tp-btn tp-btn-primary" disabled={!done || !sessionId || completing || Boolean(progressError)} onClick={proceed}>
              {footerLabel()}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
