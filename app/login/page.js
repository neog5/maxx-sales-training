"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Notice from "@/components/Notice";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

const COPY = {
  signin: { title: "Welcome back", intro: "Sign in to continue your assigned training.", submit: "Sign in" },
  signup: { title: "Create your account", intro: "Set up your account to begin training.", submit: "Create account" },
};

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState("signin"); // signin | signup
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const copy = COPY[mode];

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setConfirmationSent(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setConfirmationSent(false);
    setLoading(true);
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

  return (
    <main className="login-page">
      <div className="login-card tp-fade-in">
        <section className="login-brand">
          <div className="login-brand__top">
            <img src="/maxx-ortho-logo-white.png" alt="Maxx Orthopedics" />
            <span>Learning portal</span>
          </div>
          <div>
            <div className="login-brand__eyebrow">Rep enablement portal</div>
            <h1 className="tp-display">Knowledge that moves with you.</h1>
            <p>Focused product learning, practical checkpoints, and clear progress—all in one place.</p>
            <div className="login-brand__features" aria-label="Portal benefits">
              <span><b>✓</b> Self-paced learning</span>
              <span><b>✓</b> Immediate feedback</span>
              <span><b>✓</b> Progress tracking</span>
            </div>
          </div>
          <div className="login-brand__footer">Maxx Orthopedics · Sales enablement</div>
        </section>
        <section className="login-form">
          <div className="login-form__eyebrow">Secure access</div>
          <h2 className="tp-display">{copy.title}</h2>
          <p className="login-form__intro">{copy.intro}</p>

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
            <div className="login-field">
              <label className="tp-label" htmlFor="login-password">Password</label>
              <input id="login-password" className="tp-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={6} />
            </div>
            <Notice tone="error" className="login-notice">{error}</Notice>
            {confirmationSent && (
              <Notice tone="success" className="login-notice">Check your email to confirm your account, then sign in.</Notice>
            )}
            <button className="tp-btn tp-btn-primary" type="submit" disabled={loading} aria-busy={loading}>
              {loading ? "Loading…" : copy.submit}
            </button>
          </form>

          <div className="login-switch">
            {mode === "signin" ? (
              <>New to the portal? <button type="button" className="login-mode-switch" onClick={() => switchMode("signup")}>Create an account</button></>
            ) : (
              <>Already have an account? <button type="button" className="login-mode-switch" onClick={() => switchMode("signin")}>Sign in</button></>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
