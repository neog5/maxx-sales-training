"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyDbError } from "@/lib/db";

// Runs one change at a time and keeps its busy and error state.
//   const { run, busy, error } = useMutation();
//   await run("save", () => supabase.from("x").update(...), { duplicate: "Name taken." });
// The action returns a Supabase result; `run` resolves to its data, or null on failure.
// Pass { refresh: true } to re-render the server component afterwards (only when the page
// reads that data from props rather than local state).
export default function useMutation({ refresh = false } = {}) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const run = useCallback(async (label, action, messages) => {
    setBusy(label);
    setError("");
    try {
      const { data, error: actionError } = (await action()) || {};
      if (actionError) {
        setError(friendlyDbError(actionError, messages));
        return null;
      }
      if (refresh) router.refresh();
      return data ?? true;
    } catch (thrown) {
      setError(thrown?.message || "Something went wrong. Please try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }, [refresh, router]);

  return { run, busy, error, setError };
}
