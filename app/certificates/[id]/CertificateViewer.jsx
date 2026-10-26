"use client";

import { useEffect, useRef, useState } from "react";
import Skeleton from "@/components/Skeleton";
import { CERTIFICATE_TEMPLATE, certificateFileName } from "@/lib/certificates.mjs";

// Builds the certificate PDF in the browser from the template, previews it on a canvas
// (works on phones, unlike an embedded PDF) and offers it as a download.
export default function CertificateViewer({ certificate }) {
  const canvasRef = useRef(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    async function build() {
      try {
        const [{ renderCertificatePdf }, pdfjs, templateResponse] = await Promise.all([
          import("@/lib/certificate-pdf.mjs"),
          import("pdfjs-dist/legacy/build/pdf.mjs"),
          fetch(CERTIFICATE_TEMPLATE.file),
        ]);
        if (!templateResponse.ok) throw new Error("The certificate template could not be loaded.");
        const bytes = await renderCertificatePdf(await templateResponse.arrayBuffer(), certificate, { local: true });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));

        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
        // pdf.js takes ownership of the buffer it's given, so pass a copy.
        const loadingTask = pdfjs.getDocument({ data: bytes.slice() });
        const pdfDocument = await loadingTask.promise;
        const page = await pdfDocument.getPage(1);
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = (canvas.parentElement.clientWidth / baseViewport.width) * (window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale: Math.max(scale, 1) });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        loadingTask.destroy();
        if (!cancelled) setPdfUrl(objectUrl);
      } catch (cause) {
        if (!cancelled) setError(cause.message || "The certificate could not be created.");
      }
    }

    build();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [certificate]);

  return (
    <section className="certificate-viewer">
      <div className="certificate-actions">
        <a className="tp-btn tp-btn-primary" href={pdfUrl || undefined} download={certificateFileName(certificate)} aria-disabled={!pdfUrl}>Download PDF</a>
        <a className="tp-btn tp-btn-ghost" href={pdfUrl || undefined} target="_blank" rel="noreferrer" aria-disabled={!pdfUrl}>Open to print</a>
      </div>
      {error ? (
        <div className="tp-card admin-insight-empty" role="alert">{error}</div>
      ) : (
        <div className="tp-card certificate-preview">
          {!pdfUrl && <Skeleton className="certificate-preview__skeleton" />}
          <canvas ref={canvasRef} aria-label={`Certificate of completion for ${certificate.recipient_name}, ${certificate.course_title}`} role="img" />
        </div>
      )}
    </section>
  );
}
