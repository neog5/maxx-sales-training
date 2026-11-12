import Link from "next/link";
import BigTick from "@/components/BigTick";
import { mustFind } from "@/lib/db";
import LocalDate from "@/components/LocalDate";
import TopNav from "@/components/TopNav";
import { requireViewer } from "@/lib/auth";
import { routes } from "@/lib/routes";
import CertificateViewer from "./CertificateViewerLoader";

export default async function CertificatePage({ params }) {
  const { id } = await params;
  const { supabase, profile } = await requireViewer();

  // Row-level security limits this to the viewer's own certificates, or anyone's for managers and admins.
  const certificate = mustFind(
    await supabase
      .from("certificates")
      .select("id, certificate_number, user_id, recipient_name, course_title, course_code, issued_at, expires_at")
      .eq("id", id)
      .maybeSingle(),
    "the certificate"
  );
  const isOwn = certificate.user_id === profile.id;

  return (
    <div>
      <TopNav profile={profile} />
      <main className="tp-page certificate-page tp-fade-in">
        <Link href={isOwn ? routes.courses : routes.profile(certificate.user_id)} className="tp-btn tp-btn-ghost back-link">
          ← Back to {isOwn ? "my courses" : certificate.recipient_name}
        </Link>
        <div className="page-heading certificate-heading">
          <BigTick size={72} label="Course completed" />
          <div>
            <div className="tp-label">Certificate of completion · {certificate.course_code}</div>
            <h1 className="tp-display">{certificate.course_title}</h1>
            <p>{certificate.recipient_name} · completed <LocalDate value={certificate.issued_at} />{certificate.expires_at && <> · valid until <LocalDate value={certificate.expires_at} /></>} · {certificate.certificate_number}</p>
          </div>
        </div>
        <CertificateViewer certificate={certificate} />
      </main>
    </div>
  );
}
