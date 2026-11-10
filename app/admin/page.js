import { requireViewer } from "@/lib/auth";
import { COMPLIANCE_STATUSES, buildComplianceReport } from "@/lib/compliance";
import { fetchAll, must } from "@/lib/db";
import { fetchPeople } from "@/lib/queries";
import { canViewReports, isAdmin } from "@/lib/roles";
import AdminPage from "./AdminPage";
import ComplianceDashboardClient from "./ComplianceDashboardClient";

export default async function AdminDashboardPage({ searchParams }) {
  const { group, status } = await searchParams;
  const { supabase, profile } = await requireViewer(canViewReports);
  const admin = isAdmin(profile.role);

  // Who must complete what comes from required_courses(), which expands groups in the
  // database, so managers get accurate compliance without seeing central groups.
  // Filters use training groups (admins only) plus the viewer's own private watchlists.
  const [people, requiredPairs, courses, attempts, centralGroups, centralMembers, viewGroups, viewMembers, certificates] = await Promise.all([
    fetchPeople(supabase),
    fetchAll(() => supabase.rpc("required_courses").order("user_id").order("course_id"), "required courses"),
    supabase.from("courses").select("id, code, title, is_active, archived_at").then((result) => must(result, "courses")),
    fetchAll(
      () => supabase.from("quiz_attempts").select("user_id, course_id, passed").eq("status", "completed").eq("passed", true).order("id"),
      "passed attempts"
    ),
    admin ? supabase.from("groups").select("id, name").order("name").then((result) => must(result, "training groups")) : [],
    admin ? fetchAll(() => supabase.from("group_members").select("group_id, user_id").order("group_id").order("user_id"), "training group members") : [],
    supabase.from("view_groups").select("id, name").order("name").then((result) => must(result, "watchlists")),
    fetchAll(() => supabase.from("view_group_members").select("view_group_id, user_id").order("view_group_id").order("user_id"), "watchlist members"),
    fetchAll(() => supabase.from("certificates").select("user_id, course_id").order("id"), "certificates"),
  ]);

  const groups = [
    ...viewGroups.map((viewGroup) => ({ ...viewGroup, kind: "view" })),
    ...centralGroups.map((centralGroup) => ({ ...centralGroup, kind: "central" })),
  ];
  const memberships = [
    ...centralMembers,
    ...viewMembers.map((member) => ({ group_id: member.view_group_id, user_id: member.user_id })),
  ];
  const { rows, groupSummaries } = buildComplianceReport({
    people,
    groups,
    memberships,
    requiredPairs,
    courses,
    attempts,
    certificates,
  });
  const courseLabels = Object.fromEntries(courses.map((course) => [course.id, `${course.code} · ${course.title}`]));
  const watchlists = viewGroups.map((viewGroup) => ({
    ...viewGroup,
    memberIds: viewMembers.filter((member) => member.view_group_id === viewGroup.id).map((member) => member.user_id),
  }));

  return (
    <AdminPage profile={profile}>
      <ComplianceDashboardClient
        rows={rows}
        groupSummaries={groupSummaries}
        courseLabels={courseLabels}
        showCentralGroups={admin}
        watchlists={watchlists}
        initialGroup={groupSummaries.some((summary) => summary.id === group) ? group : "all"}
        initialStatus={COMPLIANCE_STATUSES.includes(status) ? status : "all"}
      />
    </AdminPage>
  );
}
