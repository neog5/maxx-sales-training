import TopNav from "@/components/TopNav";
import { requireViewer } from "@/lib/auth";
import { buildComplianceReport } from "@/lib/compliance.mjs";
import { canViewReports } from "@/lib/roles.mjs";
import AdminTabs from "./AdminTabs";
import ComplianceDashboardClient from "./ComplianceDashboardClient";

export default async function AdminDashboardPage({ searchParams }) {
  const { group, status } = await searchParams;
  const { supabase, profile } = await requireViewer(canViewReports);

  const [
    { data: people },
    { data: groups },
    { data: memberships },
    { data: assignments },
    { data: courses },
    { data: attempts },
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role").order("full_name"),
    supabase.from("groups").select("id, name").order("name"),
    supabase.from("group_members").select("group_id, user_id"),
    supabase.from("course_assignments").select("course_id, group_id, user_id"),
    supabase.from("courses").select("id, code, title, is_active, archived_at"),
    supabase.from("quiz_attempts").select("user_id, course_id, passed").eq("status", "completed").eq("passed", true),
  ]);

  const { rows, groupSummaries } = buildComplianceReport({
    people: people || [],
    groups: groups || [],
    memberships: memberships || [],
    assignments: assignments || [],
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
        initialGroup={groupSummaries.some((summary) => summary.id === group) ? group : "all"}
        initialStatus={["compliant", "non_compliant", "none"].includes(status) ? status : "all"}
      />
    </div>
  );
}
