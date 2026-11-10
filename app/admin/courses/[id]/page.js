import { notFound } from "next/navigation";
import { courseHistoryFilter } from "@/lib/audit";
import { requireViewer } from "@/lib/auth";
import { fetchAll, must } from "@/lib/db";
import { fetchCourseMaterials, fetchPeople } from "@/lib/queries";
import { isAdmin } from "@/lib/roles";
import AdminPage from "../../AdminPage";
import CourseAdminClient from "./CourseAdminClient";
import CourseHeader from "./CourseHeader";
import { loadCourseHeader } from "./course-data";

export default async function CourseAdminPage({ params }) {
  const { id } = await params;
  const { supabase, profile } = await requireViewer(isAdmin);
  const header = await loadCourseHeader(supabase, id);
  if (!header) notFound();

  const [assignments, groups, people, history, materials, readingQuestions] = await Promise.all([
    fetchAll(
      () => supabase.from("course_assignments").select("id, group_id, user_id, assigned_at").eq("course_id", id).order("assigned_at").order("id"),
      "course assignments"
    ),
    supabase.from("groups").select("id, name, description").order("name").then((result) => must(result, "training groups")),
    fetchPeople(supabase),
    supabase
      .from("audit_log")
      .select("id, created_at, actor_name, action, entity_type, details")
      .or(courseHistoryFilter(id))
      .order("created_at", { ascending: false })
      .limit(50)
      .then((result) => must(result, "course history")),
    fetchCourseMaterials(supabase, id),
    fetchAll(() => supabase.from("questions").select("material_id").eq("course_id", id).not("material_id", "is", null).order("id"), "reading questions"),
  ]);
  const readingCounts = {};
  for (const { material_id: materialId } of readingQuestions) readingCounts[materialId] = (readingCounts[materialId] || 0) + 1;

  return (
    <AdminPage profile={profile}>
      <main className="tp-page tp-fade-in">
        <CourseHeader {...header} active="overview" />
        <CourseAdminClient
          course={header.course}
          viewerRole={profile.role}
          recordCount={header.recordCount}
          materials={materials}
          readingCounts={readingCounts}
          assignments={assignments}
          groups={groups}
          people={people}
          history={history}
        />
      </main>
    </AdminPage>
  );
}
