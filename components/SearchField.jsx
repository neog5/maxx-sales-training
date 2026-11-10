// The search box at the start of directory toolbars.
export default function SearchField({ value, onChange, label = "Search people", placeholder = "Search by name or email…" }) {
  return (
    <label className="directory-search">
      <span className="tp-sr-only">{label}</span>
      <span className="directory-search__icon" aria-hidden="true">⌕</span>
      <input className="tp-input" type="search" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
