export default function QuestionPerformance({ groups, compact = false }) {
  return (
    <div className={`question-performance ${compact ? "is-compact" : ""}`}>
      {groups.map((group) => (
        <div className="question-performance__item" key={group.key}>
          <div className="question-performance__heading">
            <span>
              <strong>{group.label}</strong>
              <small>{group.description}</small>
            </span>
            <span className="tp-mono">{group.accuracy === null ? "—" : `${group.accuracy}%`}</span>
          </div>
          <div className="question-performance__track" aria-label={`${group.label}: ${group.accuracy === null ? "no answers" : `${group.accuracy}% correct`}`}>
            <span style={{ width: `${group.accuracy || 0}%` }} />
          </div>
          <div className="question-performance__detail">
            {group.total ? `${group.correct} of ${group.total} correct` : "No questions answered"}
          </div>
        </div>
      ))}
    </div>
  );
}
