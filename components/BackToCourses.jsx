import Link from "next/link";
import { routes } from "@/lib/routes";

export default function BackToCourses() {
  return <Link href={routes.courses} className="tp-btn tp-btn-ghost back-link">← Back to courses</Link>;
}
