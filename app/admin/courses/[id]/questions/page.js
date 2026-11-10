import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { fetchAll } from "@/lib/db";
import { fetchCourseMaterials } from "@/lib/queries";
import { generationCountFromParam } from "@/lib/question-suggestions";
import { isAdmin } from "@/lib/roles";
import AdminPage from "../../../AdminPage";
import QuestionBankClient from "../../../questions/QuestionBankClient";
import CourseHeader from "../CourseHeader";
import { loadCourseHeader } from "../course-data";

export default async function CourseQuestionsPage({ params, searchParams }) {
  const { id } = await params;
  const { suggest, reading, main } = await searchParams;
  const { supabase, profile } = await requireViewer(isAdmin);
  const header = await loadCourseHeader(supabase, id);
  if (!header) notFound();
  const archived = Boolean(header.course.archived_at);

  const [questions, materials] = await Promise.all([
    fetchAll(() => supabase.from("questions").select("*").eq("course_id", id).order("created_at").order("id"), "questions"),
    fetchCourseMaterials(supabase, id, "id, position, title"),
  ]);

  return (
    <AdminPage profile={profile}>
      <main className="tp-page tp-fade-in">
        <CourseHeader {...header} active="questions" />
        <QuestionBankClient
          course={header.course}
          readOnly={archived}
          materials={materials}
          initialQuestions={questions}
          autoSuggest={suggest === "1" && !archived}
          initialGenerationCounts={{ reading: generationCountFromParam(reading, "reading"), main: generationCountFromParam(main, "main") }}
        />
      </main>
    </AdminPage>
  );
}
