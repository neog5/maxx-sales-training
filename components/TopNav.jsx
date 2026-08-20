"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function TopNav({ profile }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef(null);

  useEffect(() => {
    function closeMenu(event) {
      if (event.key === "Escape" || (event.type === "pointerdown" && !accountRef.current?.contains(event.target))) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, []);

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
          <div className="site-nav__account" ref={accountRef}>
            <button
              type="button"
              className="site-nav__avatar"
              aria-label="Open profile menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {profile?.full_name?.trim()?.charAt(0)?.toUpperCase() || "U"}
            </button>
            {menuOpen && (
              <div className="site-nav__menu" role="menu">
                <div className="site-nav__menu-name">{profile?.full_name || "User"}</div>
                <Link href={`/profile/${profile?.id}`} className="site-nav__menu-link" role="menuitem" onClick={() => setMenuOpen(false)}>
                  View profile
                </Link>
                <button type="button" className="site-nav__menu-link is-signout" role="menuitem" onClick={signOut}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
