import { fetchAll, must } from "@/lib/db";

// Course assignments that apply to one person: made to them directly or to any of their
// groups. Admins can read every assignment, so always filter explicitly.
export async function fetchAssignmentsForUser(supabase, userId, groupIds, columns = "id, course_id, group_id, user_id") {
  const query = supabase.from("course_assignments").select(columns);
  const result = groupIds.length
    ? await query.or(`user_id.eq.${userId},group_id.in.(${groupIds.join(",")})`)
    : await query.eq("user_id", userId);
  return must(result, "course assignments") || [];
}

// Opens the person's reading session for a course, reusing an unfinished one, and returns
// { session_id, questions }: its checkpoint questions, without their answers. The database
// picks the questions and checks the answers (migration 011).
export async function startReading(supabase, courseId) {
  return must(await supabase.rpc("start_reading", { p_course_id: courseId }), "your reading session");
}

// Everyone's profile, for admin and manager screens. Archived people are left out unless
// asked for: they no longer count towards compliance and can't be assigned anything.
export async function fetchPeople(supabase, columns = "id, full_name, email, role", { includeArchived = false } = {}) {
  return fetchAll(() => {
    const query = supabase.from("profiles").select(columns);
    return (includeArchived ? query : query.is("archived_at", null)).order("full_name").order("id");
  }, "people");
}

// A course's reading decks in reading order.
export async function fetchCourseMaterials(supabase, courseId, columns = "id, position, title, pdf_url") {
  return must(
    await supabase.from("course_materials").select(columns).eq("course_id", courseId).order("position").order("created_at"),
    "course decks"
  ) || [];
}
