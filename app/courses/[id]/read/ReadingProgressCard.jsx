function ProgressRow({ label, value, percent }) {
  return (
    <div className="reading-progress-row">
      <div><span>{label}</span><b>{value}</b></div>
      <div className="reading-progress-track"><span style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

const percentOf = ({ done, total }) => Math.round((done / total) * 100);

// Reading time (when the course has a PDF; timeProgress is null otherwise), checkpoints (when
// the course has any), decks opened (multi-deck courses) and videos watched to the end.
export default function ReadingProgressCard({ status, timeProgress, questionProgress, answeredCount, questionCount, decks, videos }) {
  const deckRow = decks && { done: decks.opened, total: decks.total };
  const videoRow = videos && { done: videos.watched, total: videos.total };
  const parts = [
    ...(timeProgress === null ? [] : [timeProgress]),
    ...(questionCount ? [questionProgress] : []),
    ...(deckRow ? [percentOf(deckRow)] : []),
    ...(videoRow ? [percentOf(videoRow)] : []),
  ];
  const overall = parts.length ? Math.round(parts.reduce((sum, part) => sum + part, 0) / parts.length) : 100;
  return (
    <div className="tp-card reading-status-card">
      <div className="reading-status-card__heading">
        <div>
          <span className="tp-label">Your progress</span>
          <strong className="tp-display">{status}</strong>
        </div>
        <span className="reading-status-card__percent">{overall}%</span>
      </div>
      {timeProgress !== null && <ProgressRow label="Reading time" value={`${timeProgress}%`} percent={timeProgress} />}
      {questionCount > 0 && <ProgressRow label="Reading questions" value={`${answeredCount} of ${questionCount}`} percent={questionProgress} />}
      {deckRow && <ProgressRow label="Decks opened" value={`${deckRow.done} of ${deckRow.total}`} percent={percentOf(deckRow)} />}
      {videoRow && <ProgressRow label="Videos watched" value={`${videoRow.done} of ${videoRow.total}`} percent={percentOf(videoRow)} />}
    </div>
  );
}
