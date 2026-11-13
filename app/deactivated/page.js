import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

// Where archived people land after signing in: their records are kept, their access isn't.
export default async function DeactivatedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(routes.login);
  const { data: profile } = await supabase.from("profiles").select("archived_at").eq("id", user.id).maybeSingle();
  if (profile && !profile.archived_at) redirect(routes.courses);

  return (
    <AuthCard>
      <h1 className="tp-display login-title">Your account is deactivated</h1>
      <p className="login-form__intro">
        You no longer have access to Maxx Orthopedics Sales Training. Your training records have been kept.
        If you think this is a mistake, contact your admin.
      </p>
      <SignOutButton />
    </AuthCard>
  );
}
