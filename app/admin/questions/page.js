import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import AdminTabs from "../AdminTabs";
import QuestionBankClient from "./QuestionBankClient";
import { redirect } from "next/navigation";

export default async function QuestionsPage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/courses");

  const { data: courses } = await supabase.from("courses").select("*").order("code");
  const { data: questions } = await supabase.from("questions").select("*").order("created_at");

  return (
    <div>
      <TopNav profile={profile} />
      <div className="admin-nav tp-fade-in">
        <AdminTabs active="bank" />
      </div>
      <QuestionBankClient courses={courses || []} initialQuestions={questions || []} initialCourseId={searchParams?.course} />
    </div>
  );
}
