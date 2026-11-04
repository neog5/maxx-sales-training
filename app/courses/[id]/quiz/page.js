import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import CourseUnavailable from "@/components/CourseUnavailable";
import QuizClient from "./QuizClient";
import { attemptAllowance } from "@/lib/attempts.mjs";
import { notFound, redirect } from "next/navigation";

export default async function QuizPage({ params }) {
  const supabase = await createClient();
  const { id } = await params;
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const { data: course } = await supabase.from("courses").select("*").eq("id", id).single();
  if (!course) notFound();
  if (course.archived_at) return <CourseUnavailable profile={profile} course={course} />;
  const { data: completedReading } = await supabase
    .from("reading_sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", course.id)
    .eq("checkpoint_passed", true)
    .limit(1)
    .maybeSingle();
  if (!completedReading) redirect(`/courses/${course.id}/read`);

  // Three failed attempts, then an admin must approve more (the database enforces this too).
  const [{ data: attempts }, { data: unlocks }] = await Promise.all([
    supabase.from("quiz_attempts").select("passed, submitted_at").eq("user_id", user.id).eq("course_id", course.id).eq("status", "completed"),
    supabase.from("attempt_unlocks").select("granted_at").eq("user_id", user.id).eq("course_id", course.id),
  ]);
  const { remaining } = attemptAllowance(attempts || [], unlocks || []);

  return (
    <div>
      <TopNav profile={profile} />
      <QuizClient course={course} userId={user.id} attemptsLeft={remaining} />
    </div>
  );
}
