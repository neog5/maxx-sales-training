import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import QuizClient from "./QuizClient";
import { notFound, redirect } from "next/navigation";

export default async function QuizPage({ params }) {
  const supabase = await createClient();
  const { id } = await params;
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const { data: course } = await supabase.from("courses").select("*").eq("id", id).single();
  if (!course) notFound();
  const { data: completedReading } = await supabase
    .from("reading_sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", course.id)
    .eq("checkpoint_passed", true)
    .limit(1)
    .maybeSingle();
  if (!completedReading) redirect(`/courses/${course.id}/read`);

  // Last fail streak on this course, to compute the cooldown client-side
  const { data: lastAttempt } = await supabase
    .from("quiz_attempts")
    .select("fail_streak, passed, submitted_at")
    .eq("user_id", user.id)
    .eq("course_id", course.id)
    .eq("status", "completed")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div>
      <TopNav profile={profile} />
      <QuizClient course={course} userId={user.id} lastAttempt={lastAttempt} />
    </div>
  );
}
