import { formatMinutes } from "@/lib/format";

function ProgressRow({ label, value, percent }) {
  return (
    <div className="reading-progress-row">
      <div><span>{label}</span><b>{value}</b></div>
      <div className="reading-progress-track"><span style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

const percentOf = ({ done, total }) => Math.round((done / total) * 100);

// Reading time on the open PDF deck (`time`, null when a video is open or there's no minimum),
// checkpoints (when the course has any), decks read (courses with several PDFs) and videos
// opened. `timePercent` is the time spent across every deck, for the overall figure.
export default function ReadingProgressCard({ status, time, timePercent, questionProgress, answeredCount, questionCount, decks, videos }) {
  const deckRow = decks && { done: decks.read, total: decks.total };
  const videoRow = videos && { done: videos.opened, total: videos.total };
  const parts = [
    ...(timePercent === null ? [] : [timePercent]),
    ...(questionCount ? [questionProgress] : []),
    ...(deckRow ? [percentOf(deckRow)] : []),
    ...(videoRow ? [percentOf(videoRow)] : []),
  ];
  const overall = parts.length ? Math.round(parts.reduce((sum, part) => sum + part, 0) / parts.length) : 100;
  return (
    <div className="tp-card reading-status-card">
      <div className="reading-status-card__heading">
        <div>
          <span className="tp-label">Progress</span>
          <strong className="tp-display">{status}</strong>
        </div>
        <span className="reading-status-card__percent">{overall}%</span>
      </div>
      {time && <ProgressRow label={time.label} value={time.left > 0 ? `${formatMinutes(time.left)} left` : "Done"} percent={time.percent} />}
      {questionCount > 0 && <ProgressRow label="Questions" value={`${answeredCount} of ${questionCount}`} percent={questionProgress} />}
      {deckRow && <ProgressRow label="Decks" value={`${deckRow.done} of ${deckRow.total}`} percent={percentOf(deckRow)} />}
      {videoRow && <ProgressRow label="Videos" value={`${videoRow.done} of ${videoRow.total}`} percent={percentOf(videoRow)} />}
    </div>
  );
}
