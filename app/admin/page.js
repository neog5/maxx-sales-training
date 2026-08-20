import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import AdminTabs from "./AdminTabs";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/courses");

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("id, score, passed, submitted_at, status, user_id, course_id, profiles(full_name), courses(title)")
    .eq("status", "completed")
    .order("submitted_at", { ascending: false });

  const total = attempts?.length || 0;
  const passRate = total ? Math.round((attempts.filter((a) => a.passed).length / total) * 100) : 0;
  const avgScore = total ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / total) : 0;

  return (
    <div>
      <TopNav profile={profile} />
      <div className="admin-nav tp-fade-in">
        <AdminTabs active="dashboard" />
      </div>
      <main className="tp-page">
        <div className="page-heading">
          <div className="tp-label">Admin workspace</div>
          <h1 className="tp-display">Training dashboard</h1>
          <p>Track assessment activity and current team performance at a glance.</p>
        </div>

        <div className="metric-grid">
          <div className="tp-card metric-card">
            <div className="tp-label">Total attempts</div>
            <div className="tp-mono metric-value">{total}</div>
          </div>
          <div className="tp-card metric-card">
            <div className="tp-label">Pass rate</div>
            <div className="tp-mono metric-value" style={{ color: "var(--accent)" }}>{passRate}%</div>
          </div>
          <div className="tp-card metric-card">
            <div className="tp-label">Average score</div>
            <div className="tp-mono metric-value">{avgScore}%</div>
          </div>
        </div>

        <div className="tp-label" style={{ marginBottom: 10 }}>Attempt log</div>
        <div className="tp-card" style={{ overflow: "hidden" }}>
          <div className="attempt-table__head">
            <div>Rep</div><div>Course</div><div>Score</div><div>Status</div><div>Date</div>
          </div>
          <div className="tp-scroll" style={{ maxHeight: 400, overflowY: "auto" }}>
            {(attempts || []).map((a) => (
              <div key={a.id} className="attempt-table__row">
                <div>{a.profiles?.full_name}</div>
                <div style={{ color: "var(--dim)" }}>{a.courses?.title}</div>
                <div className="tp-mono">{a.score}%</div>
                <div>
                  <span className="tp-badge" style={{ background: a.passed ? "var(--accent-dim)" : "var(--danger-dim)", color: a.passed ? "var(--accent)" : "var(--danger)" }}>
                    {a.passed ? "Passed" : "Failed"}
                  </span>
                </div>
                <div style={{ color: "var(--faint)", fontSize: 12 }}>{new Date(a.submitted_at).toLocaleDateString()}</div>
              </div>
            ))}
            {total === 0 && <div style={{ padding: 20, color: "var(--faint)", fontSize: 13 }}>No completed attempts yet.</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
