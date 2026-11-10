const STROKE = 8;
const TICK_COUNT = 24;

// A circular progress dial with tick marks, a value label and an optional caption.
export default function Dial({ pct, size = 120, color = "var(--accent)", label, sub }) {
  const center = size / 2;
  const r = (size - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(pct, 100) / 100) * c;
  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const angle = (i / TICK_COUNT) * 2 * Math.PI - Math.PI / 2;
    const point = (radius) => [center + radius * Math.cos(angle), center + radius * Math.sin(angle)];
    const [x1, y1] = point(r + STROKE / 2 + 2);
    const [x2, y2] = point(r + STROKE / 2 + 6);
    return { x1, y1, x2, y2, active: i / TICK_COUNT <= pct / 100 };
  });
  return (
    <div className="dial" style={{ width: size, height: size }}>
      <svg className="dial__svg" width={size} height={size}>
        {ticks.map(({ active, ...line }, i) => <line key={i} {...line} stroke={active ? color : "var(--border)"} strokeWidth={1.5} />)}
        <circle cx={center} cy={center} r={r} fill="none" stroke="var(--surface2)" strokeWidth={STROKE} />
        <circle
          className="dial__progress"
          cx={center} cy={center} r={r} fill="none" stroke={color} strokeWidth={STROKE}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="dial__label">
        <div className="tp-mono dial__value" style={{ fontSize: size * 0.2 }}>{label}</div>
        {sub && <div className="dial__sub">{sub}</div>}
      </div>
    </div>
  );
}
