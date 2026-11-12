"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Notice from "@/components/Notice";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

// Opened from the reset email. The Supabase browser client signs the person in from the link's
// code as it starts up (it needs the code verifier saved when the link was requested, so the
// link only works in the same browser); then they choose a new password here.
export default function ResetPasswordPage() {
  const [supabase] = useState(createClient);
  const router = useRouter();
  const [status, setStatus] = useState("checking"); // checking | ready | invalid | saved
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;
    // getSession() waits until the client has finished reading the code from the URL.
    supabase.auth.getSession().then(({ data }) => {
      if (current) setStatus(data.session ? "ready" : "invalid");
    });
    return () => {
      current = false;
    };
  }, [supabase]);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (password !== confirm) {
      setError("The two passwords don’t match. Please type them again.");
      return;
    }
    setError("");
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(/different from the old/i.test(updateError.message) ? "Please choose a password you haven’t used before." : updateError.message);
      return;
    }
    setStatus("saved");
    setTimeout(() => {
      router.push(routes.courses);
      router.refresh();
    }, 1500);
  }

  return (
    <main className="login-page">
      <div className="login-card tp-fade-in">
        <section className="login-form">
          <div className="login-brand-mark">
            <img src="/maxx-ortho-logo.png" alt="Maxx Orthopedics" />
            <span className="tp-display">Sales Training</span>
          </div>
          <h1 className="tp-display reset-title">Choose a new password</h1>

          {status === "checking" && <p className="login-form__intro" role="status">Checking your reset link…</p>}

          {status === "invalid" && (
            <>
              <Notice tone="error" className="login-notice">
                This reset link has expired or was already used. Links only work once, and only in the browser where you asked for them.
              </Notice>
              <Link href={routes.login} className="tp-btn tp-btn-primary reset-action">Request a new link</Link>
            </>
          )}

          {status === "saved" && (
            <Notice tone="success" className="login-notice">Your password has been changed. Taking you to your courses…</Notice>
          )}

          {status === "ready" && (
            <form onSubmit={submit} className="login-fields">
              <p className="login-form__intro">Your new password must be at least 6 characters.</p>
              <div className="login-field">
                <label className="tp-label" htmlFor="reset-password">New password</label>
                <input id="reset-password" className="tp-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={6} />
              </div>
              <div className="login-field">
                <label className="tp-label" htmlFor="reset-confirm">Type it again</label>
                <input id="reset-confirm" className="tp-input" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required minLength={6} />
              </div>
              <Notice tone="error" className="login-notice">{error}</Notice>
              <button className="tp-btn tp-btn-primary" type="submit" disabled={saving} aria-busy={saving}>
                {saving ? "Saving…" : "Save new password"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
