import TopNav from "@/components/TopNav";
import { fetchCourseMaterials } from "@/lib/queries";
import { loadCourse } from "../load-course";
import ReadingGateClient from "./ReadingGateClient";

export default async function ReadPage({ params }) {
  const { supabase, profile, course, unavailable } = await loadCourse(params);
  if (unavailable) return unavailable;
  const materials = await fetchCourseMaterials(supabase, course.id);

  return (
    <div>
      <TopNav profile={profile} />
      <ReadingGateClient course={course} materials={materials} />
    </div>
  );
}
