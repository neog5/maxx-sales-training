import { requireViewer } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import AdminPage from "../../AdminPage";
import CourseFormClient from "./CourseFormClient";

export default async function NewCoursePage() {
  const { profile } = await requireViewer(isAdmin);

  return (
    <AdminPage profile={profile}>
      <CourseFormClient />
    </AdminPage>
  );
}
