// Course assignments that apply to one person: made to them directly or to any of their
// groups. Admins can read every assignment, so always filter explicitly.
export async function fetchAssignmentsForUser(supabase, userId, groupIds, columns = "id, course_id, group_id, user_id") {
  const query = supabase.from("course_assignments").select(columns);
  const { data } = groupIds.length
    ? await query.or(`user_id.eq.${userId},group_id.in.(${groupIds.join(",")})`)
    : await query.eq("user_id", userId);
  return data || [];
}
