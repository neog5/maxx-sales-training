import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import AdminTabs from "../AdminTabs";
import CourseFormClient from "./CourseFormClient";
import { redirect } from "next/navigation";

export default async function NewCoursePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/courses");

  return (
    <div>
      <TopNav profile={profile} />
      <div className="admin-nav tp-fade-in">
        <AdminTabs active="courses" />
      </div>
      <CourseFormClient />
    </div>
  );
}
