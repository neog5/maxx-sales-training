"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/routes";

const TABS = [
  { href: routes.admin, label: "Dashboard" },
  { href: routes.people, label: "People" },
  { href: routes.trainingGroups, label: "Training groups" },
  { href: routes.adminCourses, label: "Courses" },
  { href: routes.insights, label: "Insights" },
];

function isActive(tab, pathname) {
  return tab.href === routes.admin ? pathname === routes.admin : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="admin-tabs" aria-label="Admin navigation">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className="tp-btn admin-tabs__tab" aria-current={isActive(tab, pathname) ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
