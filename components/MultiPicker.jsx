"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const RESULT_LIMIT = 50;

function plural(noun) {
  return noun === "person" ? "people" : `${noun}s`;
}

function normalize(value) {
  return (value || "").toLocaleLowerCase().trim();
}

// Search-as-you-type picker for long lists (hundreds of people, dozens of courses).
// Tick several results, or "select all matching", then add them in one go.
// items: [{ id, label, sublabel?, keywords? }]. With `pasteEmails`, people can also be
// matched from a pasted list of email addresses (sublabel holds the email).
export default function MultiPicker({ items, excludeIds = [], onAdd, placeholder = "Search…", addLabel = "Add", noun = "item", busy = false, pasteEmails = false }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [unmatched, setUnmatched] = useState([]);
  const rootRef = useRef(null);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const available = useMemo(() => items.filter((item) => !excluded.has(item.id)), [items, excluded]);
  const matches = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return available;
    return available.filter((item) => {
      const haystack = normalize(`${item.label} ${item.sublabel || ""} ${item.keywords || ""}`);
      return terms.every((term) => haystack.includes(term));
    });
  }, [available, query]);
  const shown = matches.slice(0, RESULT_LIMIT);
  const labelById = useMemo(() => new Map(items.map((item) => [item.id, item.label])), [items]);

  useEffect(() => {
    function close(event) {
      if (event.key === "Escape" || (event.type === "pointerdown" && !rootRef.current?.contains(event.target))) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllMatching() {
    setSelected((current) => new Set([...current, ...matches.map((item) => item.id)]));
  }

  function matchPasted() {
    const tokens = pasteText.split(/[\s,;]+/).map(normalize).filter(Boolean);
    const byEmail = new Map(available.map((item) => [normalize(item.sublabel), item.id]));
    const found = new Set(selected);
    const missing = [];
    for (const token of new Set(tokens)) {
      const id = byEmail.get(token);
      if (id) found.add(id);
      else missing.push(token);
    }
    setSelected(found);
    setUnmatched(missing);
    if (!missing.length) {
      setPasting(false);
      setPasteText("");
    }
  }

  async function add() {
    const ids = [...selected].filter((id) => !excluded.has(id));
    if (!ids.length) return;
    const ok = await onAdd(ids);
    if (ok !== false) {
      setSelected(new Set());
      setQuery("");
      setOpen(false);
      setUnmatched([]);
    }
  }

  const selectedCount = [...selected].filter((id) => !excluded.has(id)).length;

  return (
    <div className="picker" ref={rootRef}>
      <div className="picker__bar">
        <input
          className="tp-input"
          type="search"
          placeholder={placeholder}
          aria-label={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (shown.length === 1) toggle(shown[0].id);
            }
          }}
        />
        <button type="button" className="tp-btn tp-btn-primary" disabled={!selectedCount || busy} onClick={add}>
          {busy ? "Saving…" : selectedCount ? `${addLabel} ${selectedCount}` : addLabel}
        </button>
      </div>

      {selectedCount > 0 && (
        <div className="picker__selected">
          <span>{selectedCount} {selectedCount === 1 ? noun : plural(noun)} selected{selectedCount <= 4 ? `: ${[...selected].filter((id) => !excluded.has(id)).map((id) => labelById.get(id)).join(", ")}` : ""}</span>
          <button type="button" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {open && (
        <div className="picker__panel">
          <div className="picker__panel-head">
            <span>{matches.length} {matches.length === 1 ? "match" : "matches"}{matches.length > RESULT_LIMIT ? ` · showing first ${RESULT_LIMIT}, keep typing to narrow` : ""}</span>
            {matches.length > 0 && <button type="button" onClick={selectAllMatching}>Select all {matches.length}</button>}
          </div>
          <div className="picker__results tp-scroll" role="listbox" aria-multiselectable="true">
            {shown.map((item) => (
              <label key={item.id} className={`picker__option ${selected.has(item.id) ? "is-selected" : ""}`}>
                <input type="checkbox" aria-label={item.sublabel ? `${item.label} (${item.sublabel})` : item.label} checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                <span>
                  <strong>{item.label}</strong>
                  {item.sublabel && <small>{item.sublabel}</small>}
                </span>
              </label>
            ))}
            {matches.length === 0 && <div className="picker__empty">{available.length ? "No matches." : `Everyone is already added.`}</div>}
          </div>
        </div>
      )}

      {pasteEmails && (
        <div className="picker__paste">
          {pasting ? (
            <>
              <textarea className="tp-input" rows={3} placeholder="Paste email addresses, separated by commas, spaces or new lines" value={pasteText} onChange={(event) => setPasteText(event.target.value)} />
              <div className="picker__paste-actions">
                <button type="button" className="tp-btn tp-btn-ghost" disabled={!pasteText.trim()} onClick={matchPasted}>Select matching people</button>
                <button type="button" className="picker__link" onClick={() => { setPasting(false); setUnmatched([]); }}>Cancel</button>
              </div>
              {unmatched.length > 0 && <div className="picker__unmatched">Not found or already added: {unmatched.join(", ")}</div>}
            </>
          ) : (
            <button type="button" className="picker__link" onClick={() => setPasting(true)}>Or paste a list of emails</button>
          )}
        </div>
      )}
    </div>
  );
}
