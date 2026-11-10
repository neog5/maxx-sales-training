"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAdmin } from "@/lib/roles";
import { routes } from "@/lib/routes";

const TABS = [
  { href: routes.admin, label: "Dashboard" },
  { href: routes.people, label: "People" },
  { href: routes.trainingGroups, label: "Training groups", adminOnly: true },
  { href: routes.adminCourses, label: "Courses", adminOnly: true },
  { href: routes.insights, label: "Insights" },
];

function isActive(tab, pathname) {
  return tab.href === routes.admin ? pathname === routes.admin : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export default function AdminTabs({ role }) {
  const pathname = usePathname();
  return (
    <nav className="admin-tabs" aria-label="Admin navigation">
      {TABS.filter((tab) => !tab.adminOnly || isAdmin(role)).map((tab) => (
        <Link key={tab.href} href={tab.href} className="tp-btn admin-tabs__tab" aria-current={isActive(tab, pathname) ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
