"use client";
import Link from "next/link";
import { isAdmin } from "@/lib/roles.mjs";

const TABS = [
  { key: "dashboard", href: "/admin", label: "Dashboard" },
  { key: "people", href: "/admin/people", label: "People" },
  { key: "watchlists", href: "/admin/watchlists", label: "Watchlists" },
  { key: "training-groups", href: "/admin/training-groups", label: "Training groups", adminOnly: true },
  { key: "courses", href: "/admin/courses", label: "Courses", adminOnly: true },
  { key: "insights", href: "/admin/insights", label: "Insights" },
];

export default function AdminTabs({ active, role }) {
  return (
    <nav className="admin-tabs" aria-label="Admin navigation">
      {TABS.filter((tab) => !tab.adminOnly || isAdmin(role)).map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className="tp-btn"
          aria-current={active === tab.key ? "page" : undefined}
          style={{ color: active === tab.key ? "var(--text)" : "var(--faint)", textDecoration: "none" }}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
