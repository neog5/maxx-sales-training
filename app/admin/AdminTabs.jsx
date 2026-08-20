"use client";
import Link from "next/link";

export default function AdminTabs({ active }) {
  return (
    <nav className="admin-tabs" aria-label="Admin navigation">
      <Link
        href="/admin"
        className="tp-btn"
        aria-current={active === "dashboard" ? "page" : undefined}
        style={{ color: active === "dashboard" ? "var(--text)" : "var(--faint)", textDecoration: "none" }}
      >
        Dashboard
      </Link>
      <Link
        href="/admin/questions"
        className="tp-btn"
        aria-current={active === "bank" ? "page" : undefined}
        style={{ color: active === "bank" ? "var(--text)" : "var(--faint)", textDecoration: "none" }}
      >
        Question bank
      </Link>
      <Link
        href="/admin/courses"
        className="tp-btn"
        aria-current={active === "courses" ? "page" : undefined}
        style={{ color: active === "courses" ? "var(--text)" : "var(--faint)", textDecoration: "none" }}
      >
        Add course
      </Link>
    </nav>
  );
}
