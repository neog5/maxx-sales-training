import TopNav from "@/components/TopNav";
import { must } from "@/lib/db";
import { withSignedMaterialUrls } from "@/lib/course-materials";
import { fetchCourseMaterials } from "@/lib/queries";
import { loadCourse } from "../load-course";
import ReadingGateClient from "./ReadingGateClient";

export default async function ReadPage({ params }) {
  const { supabase, profile, course, unavailable } = await loadCourse(params);
  if (unavailable) return unavailable;
  // Once the material has been finished, the page is for reviewing it: no new session, timer
  // or reading questions.
  const [rawMaterials, finishedReading, certificate] = await Promise.all([
    fetchCourseMaterials(supabase, course.id),
    supabase.from("reading_sessions").select("id").eq("user_id", profile.id).eq("course_id", course.id).eq("checkpoint_passed", true).limit(1)
      .then((result) => must(result, "your course progress")),
    supabase.from("certificates").select("id").eq("user_id", profile.id).eq("course_id", course.id).maybeSingle()
      .then((result) => must(result, "your certificate")),
  ]);
  // Links last a working day, so a long reading session doesn't lose its PDF or video.
  const materials = await withSignedMaterialUrls(supabase, rawMaterials, 8 * 60 * 60);

  return (
    <div>
      <TopNav profile={profile} />
      <ReadingGateClient course={course} materials={materials} review={finishedReading.length > 0} certificateId={certificate?.id || null} />
    </div>
  );
}
