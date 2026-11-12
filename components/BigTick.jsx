// A large green tick that draws itself in, for "you finished this" moments.
export default function BigTick({ size = 96, label = "Completed" }) {
  return (
    <span className="big-tick" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <circle className="big-tick__circle" cx="26" cy="26" r="26" />
        <path className="big-tick__check" d="M15 27.5l7.5 7.5L37.5 19" />
      </svg>
    </span>
  );
}
