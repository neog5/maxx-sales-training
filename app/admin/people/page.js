import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import AdminTabs from "../AdminTabs";
import PeopleDirectoryClient from "./PeopleDirectoryClient";

export default async function PeoplePage({ searchParams }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/courses");

  const [{ data: people }, { data: attempts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("full_name"),
    supabase
      .from("quiz_attempts")
      .select("id, user_id, score, passed, submitted_at")
      .eq("status", "completed")
      .order("submitted_at", { ascending: false }),
  ]);

  const attemptsByPerson = new Map();
  for (const attempt of attempts || []) {
    const personAttempts = attemptsByPerson.get(attempt.user_id) || [];
    personAttempts.push(attempt);
    attemptsByPerson.set(attempt.user_id, personAttempts);
  }

  const directory = (people || []).map((person) => {
    const personAttempts = attemptsByPerson.get(person.id) || [];
    const passed = personAttempts.filter((attempt) => attempt.passed).length;
    const averageScore = personAttempts.length
      ? Math.round(personAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / personAttempts.length)
      : null;

    return {
      ...person,
      attemptCount: personAttempts.length,
      averageScore,
      passRate: personAttempts.length ? Math.round((passed / personAttempts.length) * 100) : null,
      lastActiveAt: personAttempts[0]?.submitted_at || null,
      attentionStatus: personAttempts.length === 0
        ? "not-started"
        : personAttempts[0].passed
          ? "on-track"
          : "needs-attention",
    };
  });

  return (
    <div>
      <TopNav profile={profile} />
      <div className="admin-nav tp-fade-in">
        <AdminTabs active="people" />
      </div>
      <PeopleDirectoryClient
        people={directory}
        initialStatus={["on-track", "needs-attention", "not-started"].includes(status) ? status : "all"}
      />
    </div>
  );
}
