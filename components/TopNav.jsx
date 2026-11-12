"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { initial } from "@/lib/people";
import { ROLE_LABELS, canViewReports, isAdmin } from "@/lib/roles";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

// `profile` is the signed-in viewer ({ id, full_name, role }) from requireViewer().
export default function TopNav({ profile }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const accountRef = useRef(null);

  // Like YouTube: the bar slides away while scrolling down and comes back on any scroll up.
  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        if (y < 80) setHidden(false);
        else if (Math.abs(y - lastY) > 6) setHidden(y > lastY);
        lastY = y;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

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
    await createClient().auth.signOut();
    router.push(routes.login);
    router.refresh();
  }

  return (
    <header className={hidden && !menuOpen ? "site-nav is-hidden" : "site-nav"}>
      <div className="site-nav__inner">
        <Link href={routes.courses} className="site-brand">
          <img className="site-brand__logo" src="/maxx-ortho-logo.png" alt="Maxx Orthopedics" />
          <span className="tp-display site-brand__title">Sales Training</span>
        </Link>

        <div className="site-nav__actions">
          {canViewReports(profile?.role) && (
            <nav className="site-nav__primary" aria-label="Primary navigation">
              <Link href={routes.courses} className={`site-nav__link ${pathname.startsWith(routes.courses) ? "is-active" : ""}`}>Courses</Link>
              <Link href={routes.admin} className={`site-nav__link ${pathname.startsWith(routes.admin) ? "is-active" : ""}`}>{isAdmin(profile?.role) ? "Admin" : "Team"}</Link>
            </nav>
          )}
          <div className="site-nav__account" ref={accountRef}>
            <button
              type="button"
              className="site-nav__avatar"
              aria-label="Open profile menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {initial(profile?.full_name)}
            </button>
            {menuOpen && (
              <div className="site-nav__menu">
                <div className="site-nav__menu-name">
                  <span>{profile?.full_name || "User"}</span>
                  <small>{ROLE_LABELS[profile?.role] || "Learner"}</small>
                </div>
                {profile?.id && (
                  <Link href={routes.profile(profile.id)} className="site-nav__menu-link" onClick={() => setMenuOpen(false)}>
                    <span aria-hidden="true">○</span> View profile
                  </Link>
                )}
                <button type="button" className="site-nav__menu-link is-signout" onClick={signOut}>
                  <span aria-hidden="true">↗</span> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
