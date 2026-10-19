// Data shared by a course's Overview and Questions tabs.
export async function loadCourseHeader(supabase, id) {
  const [{ data: course }, { count: attemptCount }, { count: readingCount }, { count: questionCount }] = await Promise.all([
    supabase.from("courses").select("*, archiver:profiles!courses_archived_by_fkey(full_name)").eq("id", id).maybeSingle(),
    supabase.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("course_id", id),
    supabase.from("reading_sessions").select("id", { count: "exact", head: true }).eq("course_id", id),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("course_id", id),
  ]);
  if (!course) return null;
  return { course, recordCount: (attemptCount || 0) + (readingCount || 0), questionCount: questionCount || 0 };
}
