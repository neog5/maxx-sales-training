"use client";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push(routes.login);
    router.refresh();
  }

  return <button type="button" className="tp-btn tp-btn-primary" onClick={signOut}>Sign out</button>;
}
