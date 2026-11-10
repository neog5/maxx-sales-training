import { redirect } from "next/navigation";
import TopNav from "@/components/TopNav";
import { attemptAllowance } from "@/lib/attempts";
import { must } from "@/lib/db";
import { routes } from "@/lib/routes";
import { loadCourse } from "../load-course";
import QuizClient from "./QuizClient";

export default async function QuizPage({ params }) {
  const { supabase, user, profile, course, unavailable } = await loadCourse(params);
  if (unavailable) return unavailable;
  // Reading-only courses have no test; finishing the reading completes them.
  if (course.view_only) redirect(routes.read(course.id));

  const [completedReading, attempts, unlocks] = await Promise.all([
    supabase
      .from("reading_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .eq("checkpoint_passed", true)
      .limit(1)
      .maybeSingle()
      .then((result) => must(result, "your reading progress")),
    supabase
      .from("quiz_attempts")
      .select("passed, submitted_at")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .eq("status", "completed")
      .then((result) => must(result, "your attempts")),
    supabase
      .from("attempt_unlocks")
      .select("granted_at")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .then((result) => must(result, "attempt approvals")),
  ]);
  if (!completedReading) redirect(routes.read(course.id));

  // After MAX_ATTEMPTS failed attempts an admin must approve more (the database enforces this too).
  const { remaining } = attemptAllowance(attempts || [], unlocks || []);

  return (
    <div>
      <TopNav profile={profile} />
      <QuizClient course={course} attemptsLeft={remaining} />
    </div>
  );
}
