"use client";

import { useState } from "react";
import LocalDate from "@/components/LocalDate";
import { parseInviteEmails } from "@/lib/invites";
import { createClient } from "@/lib/supabase/client";
import useAdminMutation from "../useAdminMutation";

const list = (emails) => emails.join(", ");

// Sign-up is invite-only: admins add email addresses here, and only those can create an
// account (the database enforces it). An invite can put the person straight into a
// training group. `invites` are the ones nobody has used yet.
export default function InvitePanel({ invites, groups, existingEmails }) {
  const [supabase] = useState(createClient);
  const { run, busy, fail, notices } = useAdminMutation({ refresh: true });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [groupId, setGroupId] = useState("");
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));

  async function invite(event) {
    event.preventDefault();
    const parsed = parseInviteEmails(text, { existingEmails, invitedEmails: invites.map((entry) => entry.email) });
    const skipped = [
      parsed.invalid.length && `Not email addresses: ${list(parsed.invalid)}.`,
      parsed.existing.length && `Already have an account: ${list(parsed.existing)}.`,
      parsed.alreadyInvited.length && `Already invited: ${list(parsed.alreadyInvited)}.`,
    ].filter(Boolean).join(" ");
    if (!parsed.emails.length) {
      fail(skipped || "Enter at least one email address.");
      return;
    }
    const count = parsed.emails.length;
    const saved = await run(
      "invite",
      () => supabase.from("invites").insert(parsed.emails.map((email) => ({ email, group_id: groupId || null }))),
      { success: `Invited ${count} ${count === 1 ? "person" : "people"}. ${skipped}`.trim(), duplicate: "One of these addresses was just invited by someone else. Refresh and try again." }
    );
    if (saved) setText("");
  }

  function withdraw(entry) {
    if (!window.confirm(`Withdraw the invite for ${entry.email}? They won’t be able to sign up.`)) return;
    run(`withdraw-${entry.id}`, () => supabase.from("invites").delete().eq("id", entry.id), { success: `Withdrew the invite for ${entry.email}.` });
  }

  return (
    <section className="tp-card invite-panel" aria-label="Invites">
      <div className="invite-panel__head">
        <div>
          <div className="tp-label">Invites</div>
          <span>Only invited email addresses can create an account · {invites.length} waiting to sign up</span>
        </div>
        <button type="button" className="tp-btn tp-btn-primary" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? "Close" : "Invite people"}
        </button>
      </div>

      {open && (
        <>
          <form className="invite-panel__form" onSubmit={invite}>
            <label>
              <span className="tp-label">Email addresses</span>
              <textarea className="tp-input" rows={3} value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste email addresses, separated by commas, spaces or new lines" />
            </label>
            <label>
              <span className="tp-label">Add them to a training group (optional)</span>
              <select className="tp-input" value={groupId} onChange={(event) => setGroupId(event.target.value)}>
                <option value="">No training group</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
            <button type="submit" className="tp-btn tp-btn-primary" disabled={Boolean(busy) || !text.trim()}>
              {busy === "invite" ? "Inviting…" : "Send invites"}
            </button>
          </form>
          {notices}

          <div className="invite-panel__list">
            {invites.map((entry) => (
              <div key={entry.id} className="certificate-list__row">
                <div>
                  <strong>{entry.email}</strong>
                  <small>Invited <LocalDate value={entry.invited_at} />{entry.group_id && groupNames.has(entry.group_id) && <> · joins {groupNames.get(entry.group_id)}</>}</small>
                </div>
                <button type="button" className="tp-btn tp-btn-ghost" disabled={Boolean(busy)} onClick={() => withdraw(entry)}>
                  {busy === `withdraw-${entry.id}` ? "…" : "Withdraw"}
                </button>
              </div>
            ))}
            {invites.length === 0 && <div className="admin-insight-empty">Everyone invited has signed up.</div>}
          </div>
        </>
      )}
    </section>
  );
}
