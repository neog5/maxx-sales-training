"use client";
import { useCallback, useState } from "react";
import Notice from "@/components/Notice";
import useMutation from "@/hooks/useMutation";

// useMutation plus a success message, for admin panels that confirm each change.
//   const { run, busy, fail, notices } = useAdminMutation();
//   await run("save", () => supabase.from("x").update(...), { success: "Saved.", duplicate: "Name taken." });
// `fail(text)` shows a validation error; render `notices` where messages belong.
export default function useAdminMutation(options) {
  const { run: runMutation, busy, error, setError } = useMutation(options);
  const [success, setSuccess] = useState("");

  const run = useCallback(async (label, action, { success: successText, ...messages } = {}) => {
    setSuccess("");
    const data = await runMutation(label, action, messages);
    if (data && successText) setSuccess(successText);
    return data;
  }, [runMutation]);

  const fail = useCallback((text) => {
    setSuccess("");
    setError(text);
  }, [setError]);

  const clear = useCallback(() => fail(""), [fail]);

  const notices = (
    <>
      <Notice tone="error">{error}</Notice>
      <Notice tone="success">{success}</Notice>
    </>
  );

  return { run, busy, fail, clear, notices };
}
