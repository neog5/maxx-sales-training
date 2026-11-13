import TopNav from "@/components/TopNav";
import { withSignedDeckUrls } from "@/lib/course-materials";
import { fetchCourseMaterials } from "@/lib/queries";
import { loadCourse } from "../load-course";
import ReadingGateClient from "./ReadingGateClient";

export default async function ReadPage({ params }) {
  const { supabase, profile, course, unavailable } = await loadCourse(params);
  if (unavailable) return unavailable;
  // Links last a working day, so a long reading session doesn't lose its PDF.
  const materials = await withSignedDeckUrls(supabase, await fetchCourseMaterials(supabase, course.id), 8 * 60 * 60);

  return (
    <div>
      <TopNav profile={profile} />
      <ReadingGateClient course={course} materials={materials} />
    </div>
  );
}
