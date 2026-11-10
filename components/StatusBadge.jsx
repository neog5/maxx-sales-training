// Small pill for statuses. Tones map to the theme colours in globals.css.
export default function StatusBadge({ tone = "muted", className = "", children }) {
  return <span className={`tp-badge tp-badge--${tone} ${className}`.trim()}>{children}</span>;
}
