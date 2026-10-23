"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/roles.mjs";

export default function RoleEditor({ profileId, initialRole, roles }) {
  const [role, setRole] = useState(initialRole);
  const [savedRole, setSavedRole] = useState(initialRole);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function saveRole() {
    setSaving(true);
    setMessage("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", profileId)
      .select("role")
      .maybeSingle();

    if (error) {
      setMessage(`Role could not be updated: ${error.message}`);
    } else if (!data) {
      setMessage("Role update was blocked by database permissions.");
    } else {
      setRole(data.role);
      setSavedRole(data.role);
      setMessage("Role updated.");
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="role-editor">
        <select className="tp-input" aria-label="User role" value={role} onChange={(event) => setRole(event.target.value)}>
          {roles.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}
        </select>
        <button type="button" className="tp-btn tp-btn-primary" disabled={saving || role === savedRole} onClick={saveRole}>
          {saving ? "Saving…" : "Save role"}
        </button>
      </div>
      <div className="role-editor__status" role="status">{message}</div>
    </div>
  );
}
