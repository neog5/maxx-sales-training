import { redirect } from "next/navigation";

// Questions now live under each course (Admin → Courses → a course → Questions).
// Keep old links working.
export default async function QuestionsRedirect({ searchParams }) {
  const { course, suggest, reading, main } = await searchParams;
  if (!course) redirect("/admin/courses");
  const params = new URLSearchParams(Object.entries({ suggest, reading, main }).filter(([, value]) => value !== undefined));
  redirect(`/admin/courses/${course}/questions${params.size ? `?${params}` : ""}`);
}
