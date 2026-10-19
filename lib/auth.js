import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Loads the signed-in user's profile and, when `allowed` is given, sends anyone whose
// role it rejects back to their courses. Database row-level security is the real guard.
export async function requireViewer(allowed) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!profile) redirect("/login");
  if (allowed && !allowed(profile.role)) redirect("/courses");

  return { supabase, user, profile };
}
