import { notFound } from "next/navigation";
import Link from "next/link";
import LocalDate from "@/components/LocalDate";
import TopNav from "@/components/TopNav";
import { requireViewer } from "@/lib/auth";
import CertificateViewer from "./CertificateViewerLoader";

export default async function CertificatePage({ params }) {
  const { id } = await params;
  const { supabase, profile } = await requireViewer();

  // Row-level security limits this to the viewer's own certificates, or anyone's for managers and admins.
  const { data: certificate } = await supabase
    .from("certificates")
    .select("id, certificate_number, user_id, recipient_name, course_title, course_code, issued_at, expires_at")
    .eq("id", id)
    .maybeSingle();
  if (!certificate) notFound();

  const isOwn = certificate.user_id === profile.id;

  return (
    <div>
      <TopNav profile={profile} />
      <main className="tp-page certificate-page tp-fade-in">
        <Link href={isOwn ? "/courses" : `/profile/${certificate.user_id}`} className="tp-btn tp-btn-ghost back-link">
          ← Back to {isOwn ? "my courses" : certificate.recipient_name}
        </Link>
        <div className="page-heading">
          <div className="tp-label">Certificate of completion · {certificate.course_code}</div>
          <h1 className="tp-display">{certificate.course_title}</h1>
          <p>{certificate.recipient_name} · completed <LocalDate value={certificate.issued_at} />{certificate.expires_at && <> · valid until <LocalDate value={certificate.expires_at} /></>} · {certificate.certificate_number}</p>
        </div>
        <CertificateViewer certificate={certificate} />
      </main>
    </div>
  );
}
