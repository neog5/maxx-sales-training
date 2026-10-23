import { notFound } from "next/navigation";
import TopNav from "@/components/TopNav";
import { requireViewer } from "@/lib/auth";
import { isAdmin } from "@/lib/roles.mjs";
import AdminTabs from "../../AdminTabs";
import CourseAdminClient from "./CourseAdminClient";
import CourseHeader from "./CourseHeader";
import { loadCourseHeader } from "./course-data";

export default async function CourseAdminPage({ params }) {
  const { id } = await params;
  const { supabase, profile } = await requireViewer(isAdmin);
  const header = await loadCourseHeader(supabase, id);
  if (!header) notFound();

  const [{ data: assignments }, { data: groups }, { data: people }, { data: history }] = await Promise.all([
    supabase.from("course_assignments").select("id, group_id, user_id, assigned_at").eq("course_id", id).order("assigned_at"),
    supabase.from("groups").select("id, name, description").order("name"),
    supabase.from("profiles").select("id, full_name, email, role").order("full_name"),
    supabase
      .from("audit_log")
      .select("id, created_at, actor_name, action, entity_type, details")
      .or(`and(entity_type.eq.course,entity_id.eq.${id}),and(entity_type.eq.course_assignment,details->>course_id.eq.${id})`)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div>
      <TopNav profile={profile} />
      <div className="admin-nav tp-fade-in">
        <AdminTabs active="courses" role={profile.role} />
      </div>
      <main className="tp-page tp-fade-in">
        <CourseHeader {...header} active="overview" />
        <CourseAdminClient
          course={header.course}
          viewerRole={profile.role}
          recordCount={header.recordCount}
          initialAssignments={assignments || []}
          groups={groups || []}
          people={people || []}
          history={history || []}
        />
      </main>
    </div>
  );
}
