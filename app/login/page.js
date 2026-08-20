"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin"); // signin | signup
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);
    try {
      const { error } = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email, password,
            options: { data: { full_name: fullName } },
          });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      router.push("/courses");
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-card tp-fade-in">
        <section className="login-brand">
          <div className="login-brand__top">
            <img src="/maxx-ortho-logo.webp" alt="Maxx Orthopedics" />
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
          <h2 className="tp-display">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p className="login-form__intro">{mode === "signin" ? "Sign in to continue your assigned training." : "Set up your account to begin training."}</p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <div>
              <div className="tp-label" style={{ marginBottom: 6 }}>Full name</div>
              <input className="tp-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" autoComplete="name" required />
            </div>
          )}
          <div>
            <div className="tp-label" style={{ marginBottom: 6 }}>Email</div>
            <input className="tp-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required />
          </div>
          <div>
            <div className="tp-label" style={{ marginBottom: 6 }}>Password</div>
            <input className="tp-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={6} />
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</div>}
          <button className="tp-btn tp-btn-primary" type="submit" disabled={loading} aria-busy={loading} style={{ marginTop: 4 }}>
            {loading ? "Loading…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div style={{ marginTop: 16, fontSize: 12.5, color: "var(--faint)", textAlign: "center" }}>
          {mode === "signin" ? (
            <>New to the portal? <button type="button" className="login-mode-switch" onClick={() => setMode("signup")}>Create an account</button></>
          ) : (
            <>Already have an account? <button type="button" className="login-mode-switch" onClick={() => setMode("signin")}>Sign in</button></>
          )}
        </div>
        </section>
      </div>
    </main>
  );
}
