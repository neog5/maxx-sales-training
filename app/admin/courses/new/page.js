import TopNav from "@/components/TopNav";
import { requireViewer } from "@/lib/auth";
import { isAdmin } from "@/lib/roles.mjs";
import AdminTabs from "../../AdminTabs";
import CourseFormClient from "./CourseFormClient";

export default async function NewCoursePage() {
  const { profile } = await requireViewer(isAdmin);

  return (
    <div>
      <TopNav profile={profile} />
      <div className="admin-nav tp-fade-in">
        <AdminTabs active="courses" role={profile.role} />
      </div>
      <CourseFormClient />
    </div>
  );
}
