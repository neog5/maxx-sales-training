import Link from "next/link";
import { routes } from "@/lib/routes";

// Shown for a link to a page, course, person or certificate that doesn't exist (or that this
// person can't see: the database hides those, so they look the same).
export default function NotFound() {
  return (
    <main className="tp-page tp-fade-in">
      <div className="page-heading">
        <h1 className="tp-display">Page not found</h1>
        <p>It may have been removed, or it isn’t available to you.</p>
      </div>
      <Link href={routes.courses} className="tp-btn tp-btn-primary">Back to your courses</Link>
    </main>
  );
}
