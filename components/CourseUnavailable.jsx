import Link from "next/link";
import TopNav from "@/components/TopNav";
import { routes } from "@/lib/routes";

export default function CourseUnavailable({ profile, course }) {
  return (
    <div>
      <TopNav profile={profile} />
      <main className="tp-page tp-fade-in">
        <div className="page-heading">
          <h1 className="tp-display">{course.title}</h1>
          <p>This course has been archived. Your past results are still on your profile.</p>
        </div>
        <Link href={routes.courses} className="tp-btn tp-btn-primary">Back to your courses</Link>
      </main>
    </div>
  );
}
