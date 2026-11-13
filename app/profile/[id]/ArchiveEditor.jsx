"use client";

import Notice from "@/components/Notice";
import useMutation from "@/hooks/useMutation";
import { createClient } from "@/lib/supabase/client";

// Archives or restores a person. An archived person keeps every training record but can't
// use the portal, and no longer counts towards compliance. The database decides who may do
// this and stamps who did it and when (migration 012).
export default function ArchiveEditor({ profileId, name, archived }) {
  const { run, busy, error } = useMutation({ refresh: true });

  function toggle() {
    const prompt = archived
      ? `Restore ${name}? They will be able to sign in again and will count towards compliance.`
      : `Archive ${name}? They will lose access to the portal straight away. Their training records, attempts and certificates are kept, and you can restore them later.`;
    if (!window.confirm(prompt)) return;
    run("archive", () => createClient()
      .from("profiles")
      .update({ archived_at: archived ? null : new Date().toISOString() })
      .eq("id", profileId)
      .select("id")
      .maybeSingle()
      .then((result) => (result.data || result.error ? result : { error: { message: "The database didn’t allow this change." } })));
  }

  return (
    <div className="archive-editor">
      <button type="button" className="tp-btn tp-btn-ghost" disabled={Boolean(busy)} onClick={toggle}>
        {busy ? "Saving…" : archived ? "Restore person" : "Archive person"}
      </button>
      <Notice tone="error">{error}</Notice>
    </div>
  );
}
