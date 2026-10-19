import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import CourseUnavailable from "@/components/CourseUnavailable";
import ReadingGateClient from "./ReadingGateClient";
import { notFound } from "next/navigation";

export default async function ReadPage({ params }) {
  const supabase = await createClient();
  const { id } = await params;
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const { data: course } = await supabase.from("courses").select("*").eq("id", id).single();
  if (!course) notFound();
  if (course.archived_at) return <CourseUnavailable profile={profile} course={course} />;

  return (
    <div>
      <TopNav profile={profile} />
      <ReadingGateClient course={course} userId={user.id} />
    </div>
  );
}
