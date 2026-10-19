import TopNav from "@/components/TopNav";
import { requireViewer } from "@/lib/auth";
import { canViewReports } from "@/lib/roles.mjs";
import AdminTabs from "../AdminTabs";
import GroupsClient from "../training-groups/GroupsClient";

export default async function WatchlistsPage({ searchParams }) {
  const { group } = await searchParams;
  const { supabase, profile } = await requireViewer(canViewReports);

  // Row-level security returns only the signed-in person's own watchlists (table view_groups).
  const [{ data: groups }, { data: members }, { data: people }] = await Promise.all([
    supabase.from("view_groups").select("id, name, created_at").order("name"),
    supabase.from("view_group_members").select("view_group_id, user_id"),
    supabase.from("profiles").select("id, full_name, email, role").order("full_name"),
  ]);

  return (
    <div>
      <TopNav profile={profile} />
      <div className="admin-nav tp-fade-in">
        <AdminTabs active="watchlists" role={profile.role} />
      </div>
      <GroupsClient
        kind="view"
        initialGroups={groups || []}
        initialMemberships={(members || []).map((member) => ({ group_id: member.view_group_id, user_id: member.user_id }))}
        people={people || []}
        initialGroupId={group}
      />
    </div>
  );
}
