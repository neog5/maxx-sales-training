import { notFound } from "next/navigation";
import TopNav from "@/components/TopNav";
import { requireViewer } from "@/lib/auth";
import { isAdmin } from "@/lib/roles.mjs";
import AdminTabs from "../../../AdminTabs";
import QuestionBankClient from "../../../questions/QuestionBankClient";
import CourseHeader from "../CourseHeader";
import { loadCourseHeader } from "../course-data";

export default async function CourseQuestionsPage({ params, searchParams }) {
  const { id } = await params;
  const { suggest, reading, main } = await searchParams;
  const { supabase, profile } = await requireViewer(isAdmin);
  const header = await loadCourseHeader(supabase, id);
  if (!header) notFound();

  const { data: questions } = await supabase.from("questions").select("*").eq("course_id", id).order("created_at");

  return (
    <div>
      <TopNav profile={profile} />
      <div className="admin-nav tp-fade-in">
        <AdminTabs active="courses" role={profile.role} />
      </div>
      <main className="tp-page tp-fade-in">
        <CourseHeader {...header} active="questions" />
        <QuestionBankClient
          embedded
          readOnly={Boolean(header.course.archived_at)}
          courses={[header.course]}
          initialQuestions={questions || []}
          initialCourseId={id}
          autoSuggest={suggest === "1" && !header.course.archived_at}
          initialGenerationCounts={{ reading, main }}
        />
      </main>
    </div>
  );
}
