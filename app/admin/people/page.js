import { requireViewer } from "@/lib/auth";
import { ATTENTION_STATUSES, summarizeAttemptsByUser } from "@/lib/attempt-stats";
import { fetchAll } from "@/lib/db";
import { fetchPeople } from "@/lib/queries";
import { canViewReports } from "@/lib/roles";
import AdminPage from "../AdminPage";
import PeopleDirectoryClient from "./PeopleDirectoryClient";

export default async function PeoplePage({ searchParams }) {
  const { status } = await searchParams;
  const { supabase, profile } = await requireViewer(canViewReports);

  const [people, attempts] = await Promise.all([
    fetchPeople(supabase, "id, full_name, email, role, created_at"),
    fetchAll(
      () => supabase.from("quiz_attempts").select("user_id, score, passed, submitted_at").eq("status", "completed").order("id"),
      "completed attempts"
    ),
  ]);
  const statsFor = summarizeAttemptsByUser(attempts);

  return (
    <AdminPage profile={profile}>
      <PeopleDirectoryClient
        people={people.map((person) => ({ ...person, ...statsFor(person.id) }))}
        initialStatus={ATTENTION_STATUSES.includes(status) ? status : "all"}
      />
    </AdminPage>
  );
}
