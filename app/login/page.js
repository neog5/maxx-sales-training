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
          <img src="/maxx-ortho-logo.webp" alt="Maxx Orthopedics" />
          <div>
            <div className="login-brand__eyebrow">Rep enablement portal</div>
            <h1 className="tp-display">Maxx Orthopedics<br />Sales Training</h1>
            <p>Build product confidence, complete assigned learning, and demonstrate your knowledge.</p>
          </div>
        </section>
        <section className="login-form">
          <h2 className="tp-display">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p className="login-form__intro">{mode === "signin" ? "Sign in to continue your assigned training." : "Set up your account to begin training."}</p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <div>
              <div className="tp-label" style={{ marginBottom: 6 }}>Full name</div>
              <input className="tp-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          )}
          <div>
            <div className="tp-label" style={{ marginBottom: 6 }}>Email</div>
            <input className="tp-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <div className="tp-label" style={{ marginBottom: 6 }}>Password</div>
            <input className="tp-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</div>}
          <button className="tp-btn tp-btn-primary" type="submit" disabled={loading} aria-busy={loading} style={{ marginTop: 4 }}>
            {loading ? "Loading…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div style={{ marginTop: 16, fontSize: 12.5, color: "var(--faint)", textAlign: "center" }}>
          {mode === "signin" ? (
            <>No account? <span style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => setMode("signup")}>Create one</span></>
          ) : (
            <>Already have an account? <span style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => setMode("signin")}>Sign in</span></>
          )}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--faint)", textAlign: "center" }}>
          New accounts default to the "rep" role. Promote to admin via the <span className="tp-mono">profiles</span> table in Supabase.
        </div>
        </section>
      </div>
    </main>
  );
}
