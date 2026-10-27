"use client";

import dynamic from "next/dynamic";
import Skeleton from "@/components/Skeleton";

// Browser-only: keeps pdf-lib, fontkit and pdf.js out of the server bundle (the Worker has a size limit).
const CertificateViewer = dynamic(() => import("./CertificateViewer"), {
  ssr: false,
  loading: () => (
    <section className="certificate-viewer">
      <div className="certificate-actions">
        <span className="tp-btn tp-btn-primary" aria-disabled="true">Download PDF</span>
        <span className="tp-btn tp-btn-ghost" aria-disabled="true">Open to print</span>
      </div>
      <div className="tp-card certificate-preview"><Skeleton className="certificate-preview__skeleton" /></div>
    </section>
  ),
});

export default function CertificateViewerLoader(props) {
  return <CertificateViewer {...props} />;
}
