import CourseUnavailable from "@/components/CourseUnavailable";
import { mustFind } from "@/lib/db";
import { requireViewer } from "@/lib/auth";

const COURSE_COLUMNS = "id, code, title, pass_threshold, read_seconds, view_only, archived_at";

// Shared by the reading and assessment pages: the signed-in viewer and the course, or a 404.
// `unavailable` is the page to show instead when the course has been archived.
export async function loadCourse(params) {
  const { id } = await params;
  const viewer = await requireViewer();
  const course = mustFind(await viewer.supabase.from("courses").select(COURSE_COLUMNS).eq("id", id).maybeSingle(), "the course");
  const unavailable = course.archived_at ? <CourseUnavailable profile={viewer.profile} course={course} /> : null;
  return { ...viewer, course, unavailable };
}
