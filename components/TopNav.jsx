"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function TopNav({ profile }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="site-nav">
      <div className="site-nav__inner">
        <Link href="/courses" className="site-brand">
          <img className="site-brand__logo" src="/maxx-ortho-logo.webp" alt="Maxx Orthopedics" />
          <span className="tp-display site-brand__title">Sales Training</span>
        </Link>

        <div className="site-nav__actions">
          {profile?.role === "admin" && (
            <nav className="site-nav__primary" aria-label="Primary navigation">
              <Link href="/courses" className={`site-nav__link ${pathname.startsWith("/courses") ? "is-active" : ""}`}>Courses</Link>
              <Link href="/admin" className={`site-nav__link ${pathname.startsWith("/admin") ? "is-active" : ""}`}>Admin</Link>
            </nav>
          )}
          <div className="site-nav__account">
            <span className="site-nav__avatar" aria-hidden="true">{profile?.full_name?.trim()?.charAt(0)?.toUpperCase() || "U"}</span>
            <span className="site-nav__user">{profile?.full_name}</span>
            <button className="site-nav__signout" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </div>
    </header>
  );
}
