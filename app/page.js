import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? routes.courses : routes.login);
}
