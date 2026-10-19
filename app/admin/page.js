import TopNav from "@/components/TopNav";
import { requireViewer } from "@/lib/auth";
import { buildComplianceReport } from "@/lib/compliance.mjs";
import { canViewReports, isAdmin } from "@/lib/roles.mjs";
import AdminTabs from "./AdminTabs";
import ComplianceDashboardClient from "./ComplianceDashboardClient";

export default async function AdminDashboardPage({ searchParams }) {
  const { group, status } = await searchParams;
  const { supabase, profile } = await requireViewer(canViewReports);
  const admin = isAdmin(profile.role);
  const none = Promise.resolve({ data: [] });

  // Who must complete what comes from required_courses(), which expands groups in the
  // database, so managers get accurate compliance without seeing central groups.
  // Filters use training groups (admins only) plus the viewer's own private watchlists.
  const [
    { data: people },
    { data: requiredPairs },
    { data: courses },
    { data: attempts },
    { data: centralGroups },
    { data: centralMembers },
    { data: viewGroups },
    { data: viewMembers },
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role").order("full_name"),
    supabase.rpc("required_courses"),
    supabase.from("courses").select("id, code, title, is_active, archived_at"),
    supabase.from("quiz_attempts").select("user_id, course_id, passed").eq("status", "completed").eq("passed", true),
    admin ? supabase.from("groups").select("id, name").order("name") : none,
    admin ? supabase.from("group_members").select("group_id, user_id") : none,
    supabase.from("view_groups").select("id, name").order("name"),
    supabase.from("view_group_members").select("view_group_id, user_id"),
  ]);

  const groups = [
    ...(viewGroups || []).map((viewGroup) => ({ ...viewGroup, kind: "view" })),
    ...(centralGroups || []).map((centralGroup) => ({ ...centralGroup, kind: "central" })),
  ];
  const memberships = [
    ...(centralMembers || []),
    ...(viewMembers || []).map((member) => ({ group_id: member.view_group_id, user_id: member.user_id })),
  ];
  const { rows, groupSummaries } = buildComplianceReport({
    people: people || [],
    groups,
    memberships,
    requiredPairs: requiredPairs || [],
    courses: courses || [],
    attempts: attempts || [],
  });
  const courseLabels = Object.fromEntries((courses || []).map((course) => [course.id, `${course.code} · ${course.title}`]));

  return (
    <div>
      <TopNav profile={profile} />
      <div className="admin-nav tp-fade-in">
        <AdminTabs active="dashboard" role={profile.role} />
      </div>
      <ComplianceDashboardClient
        rows={rows}
        groupSummaries={groupSummaries}
        courseLabels={courseLabels}
        showCentralGroups={admin}
        initialGroup={groupSummaries.some((summary) => summary.id === group) ? group : "all"}
        initialStatus={["compliant", "non_compliant", "none"].includes(status) ? status : "all"}
      />
    </div>
  );
}
