"use client";

import { useRouter } from "next/navigation";
import { COURSE_PDF_BUCKET, COURSE_VIDEO_BUCKET, storedMaterialFile } from "@/lib/course-materials";
import { QUESTION_IMAGE_BUCKET } from "@/lib/question-images";
import { isSuperAdmin } from "@/lib/roles";
import { routes } from "@/lib/routes";
import { removeStoredFiles } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import useAdminMutation from "../../useAdminMutation";

// Deletes a deleted course's deck PDFs, videos and question images. Best effort: the course is
// already gone, so a failure only leaves unused files behind.
async function removeCourseFiles(supabase, course, materials) {
  const files = materials.map(storedMaterialFile).filter(Boolean);
  for (const bucket of [COURSE_PDF_BUCKET, COURSE_VIDEO_BUCKET]) {
    await removeStoredFiles(supabase, bucket, files.filter((file) => file.bucket === bucket).map((file) => file.path));
  }
  const { data: images } = await supabase.storage.from(QUESTION_IMAGE_BUCKET).list(course.id, { limit: 1000 });
  await removeStoredFiles(supabase, QUESTION_IMAGE_BUCKET, (images || []).map((file) => `${course.id}/${file.name}`));
}

// Archive / Restore and Delete, as small buttons beside the course title. What each one does is
// explained in the confirmation, only when it's pressed.
export default function CourseActions({ course, viewerRole, recordCount, materials }) {
  const supabase = createClient();
  const router = useRouter();
  const { run, busy, fail, notices } = useAdminMutation();
  const archived = Boolean(course.archived_at);

  async function setArchived(nextArchived) {
    const prompt = nextArchived
      ? `Archive ${course.code}? Learners lose access. Records are kept, and you can restore it.`
      : `Restore ${course.code}?`;
    if (!window.confirm(prompt)) return;
    const data = await run("archive", () => supabase.from("courses").update({ archived_at: nextArchived ? new Date().toISOString() : null }).eq("id", course.id),
      { success: nextArchived ? "Course archived." : "Course restored." });
    if (data) router.refresh();
  }

  async function deleteCourse() {
    const typed = window.prompt(`Delete ${course.code} for good? This can’t be undone. Type the course code to confirm.`);
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== course.code.toUpperCase()) {
      fail("The course code didn’t match, so nothing was deleted.");
      return;
    }
    const deleted = await run("delete", async () => {
      const result = await supabase.from("courses").delete().eq("id", course.id).select("id");
      if (!result.error && !result.data?.length) throw new Error("You don’t have permission to delete courses.");
      return result;
    }, { inUse: "This course has training records, so it can only be archived." });
    if (!deleted) return;
    await removeCourseFiles(supabase, course, materials);
    router.push(routes.adminCourses);
  }

  return (
    <div className="course-actions">
      <div className="course-actions__buttons">
        <button type="button" className="tp-btn tp-btn-ghost tp-btn--compact" disabled={Boolean(busy)} onClick={() => setArchived(!archived)}>
          {busy === "archive" ? "Saving…" : archived ? "Restore course" : "Archive course"}
        </button>
        {isSuperAdmin(viewerRole) && (
          <button type="button" className="tp-btn tp-btn-danger tp-btn--compact" disabled={recordCount > 0 || Boolean(busy)} onClick={deleteCourse}
            title={recordCount > 0 ? "It has training records. Archive it instead." : "Delete this course for good"}>
            {busy === "delete" ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>
      {notices}
    </div>
  );
}
