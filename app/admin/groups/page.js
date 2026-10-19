import TopNav from "@/components/TopNav";
import { requireViewer } from "@/lib/auth";
import { isAdmin } from "@/lib/roles.mjs";
import AdminTabs from "../AdminTabs";
import GroupsClient from "./GroupsClient";

export default async function GroupsPage({ searchParams }) {
  const { group } = await searchParams;
  const { supabase, profile } = await requireViewer(isAdmin);

  const [{ data: groups }, { data: memberships }, { data: people }, { data: courses }, { data: assignments }] = await Promise.all([
    supabase.from("groups").select("id, name, description, created_at").order("name"),
    supabase.from("group_members").select("group_id, user_id, added_at"),
    supabase.from("profiles").select("id, full_name, role").order("full_name"),
    supabase.from("courses").select("id, code, title").is("archived_at", null).order("code"),
    supabase.from("course_assignments").select("id, course_id, group_id").not("group_id", "is", null),
  ]);

  return (
    <div>
      <TopNav profile={profile} />
      <div className="admin-nav tp-fade-in">
        <AdminTabs active="groups" role={profile.role} />
      </div>
      <GroupsClient
        initialGroups={groups || []}
        initialMemberships={memberships || []}
        people={people || []}
        courses={courses || []}
        initialAssignments={assignments || []}
        initialGroupId={group}
      />
    </div>
  );
}
