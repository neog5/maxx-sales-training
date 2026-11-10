function ProgressRow({ label, value, percent }) {
  return (
    <div className="reading-progress-row">
      <div><span>{label}</span><b>{value}</b></div>
      <div className="reading-progress-track"><span style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

// Reading time, checkpoints and (for multi-deck courses) decks opened.
export default function ReadingProgressCard({ status, timeProgress, questionProgress, answeredCount, questionCount, decks }) {
  return (
    <div className="tp-card reading-status-card">
      <div className="reading-status-card__heading">
        <div>
          <span className="tp-label">Your progress</span>
          <strong className="tp-display">{status}</strong>
        </div>
        <span className="reading-status-card__percent">{Math.round((timeProgress + questionProgress) / 2)}%</span>
      </div>
      <ProgressRow label="Reading time" value={`${timeProgress}%`} percent={timeProgress} />
      <ProgressRow label="Checkpoints" value={`${answeredCount}/${questionCount}`} percent={questionProgress} />
      {decks && <ProgressRow label="Decks opened" value={`${decks.opened}/${decks.total}`} percent={Math.round((decks.opened / decks.total) * 100)} />}
    </div>
  );
}
