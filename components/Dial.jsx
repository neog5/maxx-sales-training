export default function Dial({ pct, size = 120, color = "var(--accent)", label, sub }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(pct, 100) / 100) * c;
  const ticks = Array.from({ length: 24 });
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        {ticks.map((_, i) => {
          const angle = (i / ticks.length) * 2 * Math.PI - Math.PI / 2;
          const active = i / ticks.length <= pct / 100;
          const x1 = size / 2 + (r + stroke / 2 + 2) * Math.cos(angle);
          const y1 = size / 2 + (r + stroke / 2 + 2) * Math.sin(angle);
          const x2 = size / 2 + (r + stroke / 2 + 6) * Math.cos(angle);
          const y2 = size / 2 + (r + stroke / 2 + 6) * Math.sin(angle);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={active ? color : "var(--border)"} strokeWidth={1.5} />;
        })}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .4s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="tp-mono" style={{ fontSize: size * 0.2, fontWeight: 600, color: "var(--text)" }}>{label}</div>
        {sub && <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 2, textTransform: "uppercase", letterSpacing: ".06em" }}>{sub}</div>}
      </div>
    </div>
  );
}
