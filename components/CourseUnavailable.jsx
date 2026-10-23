import Link from "next/link";
import TopNav from "@/components/TopNav";

export default function CourseUnavailable({ profile, course }) {
  return (
    <div>
      <TopNav profile={profile} />
      <main className="tp-page tp-fade-in">
        <div className="page-heading">
          <div className="tp-label tp-mono">{course.code}</div>
          <h1 className="tp-display">{course.title}</h1>
          <p>This course has been archived and can no longer be started. Your past results are still saved on your profile.</p>
        </div>
        <Link href="/courses" className="tp-btn tp-btn-primary">Back to your courses</Link>
      </main>
    </div>
  );
}
