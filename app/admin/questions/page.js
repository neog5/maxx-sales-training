import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

// Questions now live under each course (Admin → Courses → a course → Questions).
// Keep old links working.
export default async function QuestionsRedirect({ searchParams }) {
  const { course, suggest, reading, main } = await searchParams;
  if (!course) redirect(routes.adminCourses);
  const params = new URLSearchParams(Object.entries({ suggest, reading, main }).filter(([, value]) => value !== undefined));
  redirect(`${routes.adminCourseQuestions(course)}${params.size ? `?${params}` : ""}`);
}
