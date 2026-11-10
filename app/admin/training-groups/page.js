import { requireViewer } from "@/lib/auth";
import { fetchAll, must } from "@/lib/db";
import { fetchPeople } from "@/lib/queries";
import { isAdmin } from "@/lib/roles";
import AdminPage from "../AdminPage";
import GroupsClient from "./GroupsClient";

export default async function TrainingGroupsPage({ searchParams }) {
  const { group } = await searchParams;
  const { supabase, profile } = await requireViewer(isAdmin);

  const [groups, memberships, people, courses, assignments] = await Promise.all([
    supabase.from("groups").select("id, name, description, created_at").order("name").then((result) => must(result, "training groups")),
    fetchAll(() => supabase.from("group_members").select("group_id, user_id, added_at").order("group_id").order("user_id"), "training group members"),
    fetchPeople(supabase),
    supabase.from("courses").select("id, code, title").is("archived_at", null).order("code").then((result) => must(result, "courses")),
    fetchAll(() => supabase.from("course_assignments").select("id, course_id, group_id").not("group_id", "is", null).order("id"), "course assignments"),
  ]);

  return (
    <AdminPage profile={profile}>
      <GroupsClient
        initialGroups={groups}
        initialMemberships={memberships}
        people={people}
        courses={courses}
        initialAssignments={assignments}
        initialGroupId={group}
      />
    </AdminPage>
  );
}
