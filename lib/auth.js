import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { canViewReports } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

const PROFILE_COLUMNS = "id, full_name, role";

async function loadViewer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle();
  return { supabase, user, profile };
}

// Loads the signed-in user's profile for a page and, when `allowed` is given, sends anyone
// whose role it rejects back to their courses. Database row-level security is the real guard.
export async function requireViewer(allowed) {
  const viewer = await loadViewer();
  if (!viewer.user || !viewer.profile) redirect("/login");
  if (allowed && !allowed(viewer.profile.role)) redirect("/courses");
  return viewer;
}

// For pages about one person: managers and admins see anyone, others only themselves.
export async function requireSelfOrReports(personId) {
  const viewer = await requireViewer();
  if (viewer.profile.id !== personId && !canViewReports(viewer.profile.role)) redirect(`/profile/${viewer.profile.id}`);
  return viewer;
}

// The same check for route handlers: returns { supabase, profile } or { response } to send.
export async function requireApiViewer(allowed) {
  const viewer = await loadViewer();
  if (!viewer.user || !viewer.profile) return { response: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }) };
  if (allowed && !allowed(viewer.profile.role)) return { response: NextResponse.json({ error: "You don't have access to this." }, { status: 403 }) };
  return viewer;
}
