import { requireViewer } from "@/lib/auth";
import { ATTENTION_STATUSES, requiredAttemptsOnly, summarizeAttemptsByUser } from "@/lib/attempt-stats";
import { fetchAll, must } from "@/lib/db";
import { fetchPeople } from "@/lib/queries";
import { isAdmin } from "@/lib/roles";
import AdminPage from "../AdminPage";
import PeopleDirectoryClient from "./PeopleDirectoryClient";

export default async function PeoplePage({ searchParams }) {
  const { status } = await searchParams;
  const { supabase, profile } = await requireViewer(isAdmin);

  const [people, attempts, requiredPairs, invites, groups] = await Promise.all([
    fetchPeople(supabase, "id, full_name, email, role, created_at, archived_at", { includeArchived: true }),
    fetchAll(
      () => supabase.from("quiz_attempts").select("user_id, course_id, score, passed, submitted_at").eq("status", "completed").order("id"),
      "completed attempts"
    ),
    fetchAll(() => supabase.rpc("required_courses").order("user_id").order("course_id"), "required courses"),
    supabase.from("invites").select("id, email, group_id, invited_at").is("accepted_at", null).order("invited_at", { ascending: false }).then((result) => must(result, "invites")),
    supabase.from("groups").select("id, name").order("name").then((result) => must(result, "training groups")),
  ]);
  // Only attempts on required courses count toward someone's status and performance.
  const statsFor = summarizeAttemptsByUser(requiredAttemptsOnly(attempts, requiredPairs));

  return (
    <AdminPage profile={profile}>
      <PeopleDirectoryClient
        people={people.map((person) => ({ ...person, ...statsFor(person.id) }))}
        initialStatus={ATTENTION_STATUSES.includes(status) || status === "archived" ? status : "all"}
        invites={invites}
        groups={groups}
      />
    </AdminPage>
  );
}
