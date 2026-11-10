import { must } from "@/lib/db";

// Data shared by a course's Overview and Questions tabs. Returns null when there's no such course.
export async function loadCourseHeader(supabase, id) {
  const count = (table) => supabase.from(table).select("id", { count: "exact", head: true }).eq("course_id", id);
  const [courseResult, attempts, readings, questions] = await Promise.all([
    supabase.from("courses").select("*, archiver:profiles!courses_archived_by_fkey(full_name)").eq("id", id).maybeSingle(),
    count("quiz_attempts"),
    count("reading_sessions"),
    count("questions"),
  ]);
  const course = must(courseResult, "the course");
  if (!course) return null;
  for (const [result, what] of [[attempts, "attempts"], [readings, "reading sessions"], [questions, "questions"]]) must(result, what);
  return { course, recordCount: (attempts.count || 0) + (readings.count || 0), questionCount: questions.count || 0 };
}
