// A message box. `tone` is "warn" (default), "error" or "success"; errors are announced.
export default function Notice({ tone = "warn", className = "", children }) {
  if (!children) return null;
  const toneClass = tone === "warn" ? "" : `notice--${tone}`;
  return (
    <div className={`notice ${toneClass} ${className}`.replace(/\s+/g, " ").trim()} role={tone === "error" ? "alert" : undefined}>
      {children}
    </div>
  );
}
