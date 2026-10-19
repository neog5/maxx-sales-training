"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MemberList from "@/components/MemberList";
import MultiPicker from "@/components/MultiPicker";
import { createClient } from "@/lib/supabase/client";
import { personItems } from "@/lib/picker-items.mjs";

// A light row of personal watchlists on the dashboard: private lists of people to keep
// an eye on (stored in view_groups). Create, edit and filter without leaving the page.
export default function WatchlistBar({ watchlists, summaries, people, selectedId, onSelect }) {
  const supabase = createClient();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [rename, setRename] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const personOptions = useMemo(() => personItems(people), [people]);
  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const editing = watchlists.find((watchlist) => watchlist.id === editingId);
  const members = (editing?.memberIds || []).map((id) => peopleById.get(id)).filter(Boolean)
    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

  async function run(action) {
    setBusy(true);
    setError("");
    const { data, error: mutationError } = await action();
    setBusy(false);
    if (mutationError) {
      setError(/duplicate key|unique/i.test(mutationError.message) ? "You already have a watchlist with that name." : mutationError.message);
      return false;
    }
    router.refresh();
    return data ?? true;
  }

  async function create(event) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const created = await run(() => supabase.from("view_groups").insert({ name }).select("id").single());
    if (created) {
      setCreating(false);
      setNewName("");
      setEditingId(created.id);
      setRename(name);
      onSelect(created.id);
    }
  }

  function openEditor(watchlist) {
    setEditingId(editingId === watchlist.id ? null : watchlist.id);
    setRename(watchlist.name);
    setError("");
    onSelect(watchlist.id);
  }

  async function remove() {
    if (!window.confirm(`Delete your watchlist “${editing.name}”? Nobody’s training is affected.`)) return;
    if (await run(() => supabase.from("view_groups").delete().eq("id", editing.id))) {
      setEditingId(null);
      onSelect("all");
    }
  }

  return (
    <section className="watchlists" aria-label="Your watchlists">
      <div className="watchlists__row">
        <span className="watchlists__label">☆ Watchlists</span>
        {watchlists.map((watchlist) => {
          const summary = summaries.get(watchlist.id);
          return (
            <span key={watchlist.id} className={`watchlist-pill ${selectedId === watchlist.id ? "is-selected" : ""}`}>
              <button type="button" onClick={() => onSelect(selectedId === watchlist.id ? "all" : watchlist.id)} aria-pressed={selectedId === watchlist.id}>
                {watchlist.name}
                <small className={summary?.nonCompliantCount ? "has-gaps" : ""}>
                  {summary?.assessedCount ? `${summary.compliantCount}/${summary.assessedCount}` : watchlist.memberIds.length}
                </small>
              </button>
              <button type="button" className="watchlist-pill__edit" aria-label={`Edit ${watchlist.name}`} onClick={() => openEditor(watchlist)}>✎</button>
            </span>
          );
        })}
        {creating ? (
          <form className="watchlists__create" onSubmit={create}>
            <input className="tp-input" autoFocus aria-label="Watchlist name" placeholder="e.g. My team" value={newName} onChange={(event) => setNewName(event.target.value)} />
            <button type="submit" className="tp-btn tp-btn-primary" disabled={busy || !newName.trim()}>Create</button>
            <button type="button" className="picker__link" onClick={() => { setCreating(false); setNewName(""); }}>Cancel</button>
          </form>
        ) : (
          <button type="button" className="watchlists__new" onClick={() => setCreating(true)}>+ {watchlists.length ? "New" : "Create a watchlist to follow your team"}</button>
        )}
      </div>

      {editing && (
        <div className="tp-card watchlists__editor">
          <div className="watchlists__editor-head">
            <form onSubmit={async (event) => { event.preventDefault(); if (rename.trim() && rename.trim() !== editing.name) await run(() => supabase.from("view_groups").update({ name: rename.trim() }).eq("id", editing.id)); }}>
              <input className="tp-input" aria-label="Watchlist name" value={rename} onChange={(event) => setRename(event.target.value)} />
              <button type="submit" className="tp-btn tp-btn-ghost" disabled={busy || !rename.trim() || rename.trim() === editing.name}>Rename</button>
            </form>
            <div>
              <button type="button" className="tp-btn tp-btn-danger" disabled={busy} onClick={remove}>Delete</button>
              <button type="button" className="tp-btn tp-btn-ghost" onClick={() => setEditingId(null)}>Done</button>
            </div>
          </div>
          <p className="course-admin__hint">Only you can see this list. It doesn’t change what anyone has to complete.</p>
          <MultiPicker items={personOptions} excludeIds={editing.memberIds} placeholder="Add people by name or email…" noun="person" busy={busy} pasteEmails
            onAdd={(ids) => run(() => supabase.from("view_group_members").insert(ids.map((userId) => ({ view_group_id: editing.id, user_id: userId }))))} />
          <MemberList people={members} busy={busy} emptyText="No one on this watchlist yet"
            onRemove={(person) => run(() => supabase.from("view_group_members").delete().eq("view_group_id", editing.id).eq("user_id", person.id))} />
        </div>
      )}
      {error && <div className="notice notice--error" role="alert">{error}</div>}
    </section>
  );
}
