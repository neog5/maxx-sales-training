"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import Notice from "@/components/Notice";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

const COPY = {
  signin: { title: "Welcome back", submit: "Sign in" },
  signup: { title: "Create your account", submit: "Create account" },
  forgot: { title: "Reset your password", intro: "Enter your email and we’ll send you a link to choose a new password.", submit: "Send reset link" },
};

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState("signin"); // signin | signup | forgot
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const copy = COPY[mode];

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setConfirmationSent(false);
    setResetSent(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setConfirmationSent(false);
    setLoading(true);
    if (mode === "forgot") {
      await sendResetLink();
      setLoading(false);
      return;
    }
    try {
      const { data, error: authError } = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });

      if (authError) {
        setError(authError.message);
      } else if (!data.session) {
        // Sign-up with email confirmation turned on: there is no session until the link is clicked.
        setConfirmationSent(true);
      } else {
        router.push(routes.courses);
        router.refresh();
        return;
      }
    } catch {
      setError("Unable to connect. Please try again.");
    }
    setLoading(false);
  }

  // Supabase emails a link that signs the person in on /reset-password, where they choose a new password.
  // The message is the same whether or not the email has an account, so it can't be used to look accounts up.
  async function sendResetLink() {
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${routes.resetPassword}` });
      if (authError && authError.status === 429) setError("Too many reset emails were requested. Please wait a few minutes and try again.");
      else if (authError && authError.status !== 400 && authError.status !== 404) setError(authError.message);
      else setResetSent(true);
    } catch {
      setError("Unable to connect. Please try again.");
    }
  }

  return (
    <AuthCard>
      <h1 className="tp-display login-title">{copy.title}</h1>
      {copy.intro && <p className="login-form__intro">{copy.intro}</p>}

      <form onSubmit={submit} className="login-fields">
        {mode === "signup" && (
          <div className="login-field">
            <label className="tp-label" htmlFor="login-name">Full name</label>
            <input id="login-name" className="tp-input" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Jane Smith" autoComplete="name" required />
          </div>
        )}
        <div className="login-field">
          <label className="tp-label" htmlFor="login-email">Email</label>
          <input id="login-email" className="tp-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" required />
        </div>
        {mode !== "forgot" && (
          <div className="login-field">
            <div className="login-field__label-row">
              <label className="tp-label" htmlFor="login-password">Password</label>
              {mode === "signin" && <button type="button" className="login-mode-switch" onClick={() => switchMode("forgot")}>Forgot password?</button>}
            </div>
            <input id="login-password" className="tp-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={6} />
          </div>
        )}
        <Notice tone="error" className="login-notice">{error}</Notice>
        {resetSent && (
          <Notice tone="success" className="login-notice">
            If an account exists for {email}, we’ve sent it a reset link. Check your inbox (and spam folder), then open the link on this device.
          </Notice>
        )}
        {confirmationSent && (
          <Notice tone="success" className="login-notice">Check your email to confirm your account, then sign in.</Notice>
        )}
        <button className="tp-btn tp-btn-primary" type="submit" disabled={loading} aria-busy={loading}>
          {loading ? "Please wait…" : copy.submit}
        </button>
      </form>

      <div className="login-switch">
        {mode === "signin" ? (
          <>New to the portal? <button type="button" className="login-mode-switch" onClick={() => switchMode("signup")}>Create an account</button></>
        ) : mode === "forgot" ? (
          <>Remembered it? <button type="button" className="login-mode-switch" onClick={() => switchMode("signin")}>Back to sign in</button></>
        ) : (
          <>Already have an account? <button type="button" className="login-mode-switch" onClick={() => switchMode("signin")}>Sign in</button></>
        )}
      </div>
    </AuthCard>
  );
}
