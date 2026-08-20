import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import RoleEditor from "./RoleEditor";

export default async function ProfilePage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viewer } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!viewer) redirect("/login");
  if (id !== user.id && viewer.role !== "admin") redirect(`/profile/${user.id}`);

  const { data: person } = await supabase.from("profiles").select("id, full_name, role").eq("id", id).single();
  if (!person) notFound();

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("id, score, passed, submitted_at, status, courses(title)")
    .eq("user_id", id)
    .eq("status", "completed")
    .order("submitted_at", { ascending: false });

  return (
    <div>
      <TopNav profile={viewer} />
      <main className="tp-page tp-page-narrow tp-fade-in">
        <div className="page-heading">
          <div className="tp-label">Profile</div>
          <h1 className="tp-display">Team member profile</h1>
        </div>

        <section className="tp-card profile-summary">
          <div className="profile-summary__identity">
            <div className="profile-summary__avatar" aria-hidden="true">{person.full_name?.trim()?.charAt(0)?.toUpperCase() || "U"}</div>
            <div>
              <h2 className="profile-summary__name tp-display">{person.full_name}</h2>
              <div className="profile-summary__role">{person.role}</div>
            </div>
          </div>
          {viewer.role === "admin" && <RoleEditor profileId={person.id} initialRole={person.role} />}
        </section>

        <div className="tp-label" style={{ marginBottom: 10 }}>Test history</div>
        <section className="tp-card profile-history">
          <div className="profile-attempt-table__head">
            <div>Course</div><div>Score</div><div>Status</div><div>Date</div>
          </div>
          <div className="tp-scroll" style={{ maxHeight: 440, overflowY: "auto" }}>
            {(attempts || []).map((attempt) => (
              <div key={attempt.id} className="profile-attempt-table__row">
                <div>{attempt.courses?.title || "Course"}</div>
                <div className="tp-mono">{attempt.score}%</div>
                <div>
                  <span className="tp-badge" style={{ background: attempt.passed ? "var(--success-dim)" : "var(--danger-dim)", color: attempt.passed ? "var(--success)" : "var(--danger)" }}>
                    {attempt.passed ? "Passed" : "Failed"}
                  </span>
                </div>
                <div style={{ color: "var(--faint)", fontSize: 12 }}>{new Date(attempt.submitted_at).toLocaleDateString()}</div>
              </div>
            ))}
            {(!attempts || attempts.length === 0) && <div style={{ padding: 20, color: "var(--faint)", fontSize: 13 }}>No completed tests yet.</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
