"use client";

import { useMemo, useState } from "react";
import MemberList from "@/components/MemberList";
import MultiPicker from "@/components/MultiPicker";
import Notice from "@/components/Notice";
import useMutation from "@/hooks/useMutation";
import { byName } from "@/lib/people";
import { personItems } from "@/lib/picker-items";
import { createClient } from "@/lib/supabase/client";

const DUPLICATE_NAME = { duplicate: "You already have a watchlist with that name." };

// A light row of personal watchlists on the dashboard: private lists of people to keep
// an eye on (stored in view_groups). Create, edit and filter without leaving the page.
// Watchlists and their compliance summaries come from the server, so every change refreshes.
export default function WatchlistBar({ watchlists, summaries, people, selectedId, onSelect }) {
  const supabase = createClient();
  const { run, busy, error, setError } = useMutation({ refresh: true });
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [rename, setRename] = useState("");

  const personOptions = useMemo(() => personItems(people), [people]);
  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const editing = watchlists.find((watchlist) => watchlist.id === editingId);
  const members = (editing?.memberIds || []).map((id) => peopleById.get(id)).filter(Boolean).sort(byName);
  const trimmedRename = rename.trim();

  async function create(event) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const created = await run("create", () => supabase.from("view_groups").insert({ name }).select("id").single(), DUPLICATE_NAME);
    if (!created) return;
    setCreating(false);
    setNewName("");
    setEditingId(created.id);
    setRename(name);
    onSelect(created.id);
  }

  function cancelCreate() {
    setCreating(false);
    setNewName("");
  }

  function openEditor(watchlist) {
    setEditingId(editingId === watchlist.id ? null : watchlist.id);
    setRename(watchlist.name);
    setError("");
    onSelect(watchlist.id);
  }

  async function saveName(event) {
    event.preventDefault();
    if (!trimmedRename || trimmedRename === editing.name) return;
    await run("rename", () => supabase.from("view_groups").update({ name: trimmedRename }).eq("id", editing.id), DUPLICATE_NAME);
  }

  async function remove() {
    if (!window.confirm(`Delete your watchlist “${editing.name}”? Nobody’s training is affected.`)) return;
    if (await run("delete", () => supabase.from("view_groups").delete().eq("id", editing.id))) {
      setEditingId(null);
      onSelect("all");
    }
  }

  function addMembers(userIds) {
    return run("members", () => supabase.from("view_group_members").insert(userIds.map((userId) => ({ view_group_id: editing.id, user_id: userId }))));
  }

  function removeMember(person) {
    return run("members", () => supabase.from("view_group_members").delete().eq("view_group_id", editing.id).eq("user_id", person.id));
  }

  return (
    <section className="watchlists" aria-label="Your watchlists">
      <div className="watchlists__row">
        <span className="watchlists__label">☆ Watchlists</span>
        {watchlists.map((watchlist) => {
          const summary = summaries.get(watchlist.id);
          const selected = selectedId === watchlist.id;
          return (
            <span key={watchlist.id} className={`watchlist-pill ${selected ? "is-selected" : ""}`}>
              <button type="button" onClick={() => onSelect(selected ? "all" : watchlist.id)} aria-pressed={selected}>
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
            <button type="submit" className="tp-btn tp-btn-primary" disabled={Boolean(busy) || !newName.trim()}>Create</button>
            <button type="button" className="picker__link" onClick={cancelCreate}>Cancel</button>
          </form>
        ) : (
          <button type="button" className="watchlists__new" onClick={() => setCreating(true)}>+ {watchlists.length ? "New" : "Create a watchlist to follow your team"}</button>
        )}
      </div>

      {editing && (
        <div className="tp-card watchlists__editor">
          <div className="watchlists__editor-head">
            <form onSubmit={saveName}>
              <input className="tp-input" aria-label="Watchlist name" value={rename} onChange={(event) => setRename(event.target.value)} />
              <button type="submit" className="tp-btn tp-btn-ghost" disabled={Boolean(busy) || !trimmedRename || trimmedRename === editing.name}>Rename</button>
            </form>
            <div>
              <button type="button" className="tp-btn tp-btn-danger" disabled={Boolean(busy)} onClick={remove}>Delete</button>
              <button type="button" className="tp-btn tp-btn-ghost" onClick={() => setEditingId(null)}>Done</button>
            </div>
          </div>
          <p className="course-admin__hint">Only you can see this list. It doesn’t change what anyone has to complete.</p>
          <MultiPicker items={personOptions} excludeIds={editing.memberIds} placeholder="Add people by name or email…" noun="person" busy={Boolean(busy)} pasteEmails onAdd={addMembers} />
          <MemberList people={members} busy={Boolean(busy)} emptyText="No one on this watchlist yet" onRemove={removeMember} />
        </div>
      )}
      <Notice tone="error">{error}</Notice>
    </section>
  );
}
