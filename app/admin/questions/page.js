import { requireViewer } from "@/lib/auth";
import { isAdmin } from "@/lib/roles.mjs";
import TopNav from "@/components/TopNav";
import AdminTabs from "../AdminTabs";
import QuestionBankClient from "./QuestionBankClient";

export default async function QuestionsPage({ searchParams }) {
  const { course, suggest, reading, main } = await searchParams;
  const { supabase, profile } = await requireViewer(isAdmin);

  const { data: courses } = await supabase.from("courses").select("*").is("archived_at", null).order("code");
  const { data: questions } = await supabase.from("questions").select("*").order("created_at");

  return (
    <div>
      <TopNav profile={profile} />
      <div className="admin-nav tp-fade-in">
        <AdminTabs active="bank" role={profile.role} />
      </div>
      <QuestionBankClient
        courses={courses || []}
        initialQuestions={questions || []}
        initialCourseId={course}
        autoSuggest={suggest === "1"}
        initialGenerationCounts={{ reading, main }}
      />
    </div>
  );
}
