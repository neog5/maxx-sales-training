function ProgressRow({ label, value, percent }) {
  return (
    <div className="reading-progress-row">
      <div><span>{label}</span><b>{value}</b></div>
      <div className="reading-progress-track"><span style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

// Reading time, checkpoints (when the course has any) and, for multi-deck courses, decks opened.
export default function ReadingProgressCard({ status, timeProgress, questionProgress, answeredCount, questionCount, decks }) {
  const parts = [timeProgress, ...(questionCount ? [questionProgress] : []), ...(decks ? [Math.round((decks.opened / decks.total) * 100)] : [])];
  const overall = Math.round(parts.reduce((sum, part) => sum + part, 0) / parts.length);
  return (
    <div className="tp-card reading-status-card">
      <div className="reading-status-card__heading">
        <div>
          <span className="tp-label">Your progress</span>
          <strong className="tp-display">{status}</strong>
        </div>
        <span className="reading-status-card__percent">{overall}%</span>
      </div>
      <ProgressRow label="Reading time" value={`${timeProgress}%`} percent={timeProgress} />
      {questionCount > 0 && <ProgressRow label="Reading questions" value={`${answeredCount} of ${questionCount}`} percent={questionProgress} />}
      {decks && <ProgressRow label="Decks opened" value={`${decks.opened} of ${decks.total}`} percent={Math.round((decks.opened / decks.total) * 100)} />}
    </div>
  );
}
