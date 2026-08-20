"use client";

import { useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();

export default function PdfReader({ url, title, onPageChange }) {
  const scrollRef = useRef(null);
  const pagesRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let loadingTask;

    async function renderPdf() {
      setStatus("loading");
      setError("");
      try {
        loadingTask = getDocument({ url });
        const pdfDocument = await loadingTask.promise;
        const pageContainer = pagesRef.current;
        const reader = scrollRef.current;
        if (cancelled || !pageContainer || !reader) return;
        pageContainer.replaceChildren();
        const availableWidth = Math.max(reader.clientWidth - 32, 320);

        for (let number = 1; number <= pdfDocument.numPages; number += 1) {
          const page = await pdfDocument.getPage(number);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = availableWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });
          const outputScale = Math.min(window.devicePixelRatio || 1, 2);
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;

          const pageElement = document.createElement("section");
          pageElement.dataset.page = number;
          pageElement.style.cssText = "background:white; box-shadow:0 2px 10px rgba(0,0,0,.25); line-height:0;";
          pageElement.append(canvas);
          pageContainer.append(pageElement);
          await page.render({ canvasContext: context, viewport, transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0] }).promise;
          if (cancelled) return;
        }
        if (!cancelled) {
          setStatus("ready");
          onPageChange(1);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause.message || "The PDF could not be loaded.");
          setStatus("error");
        }
      }
    }

    renderPdf();
    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [url, onPageChange]);

  function trackPage() {
    const reader = scrollRef.current;
    const pages = pagesRef.current?.children;
    if (!reader || !pages?.length) return;
    const readerMidpoint = reader.scrollTop + reader.clientHeight / 2;
    let closest = pages[0];
    let distance = Infinity;
    Array.from(pages).forEach((page) => {
      const midpoint = page.offsetTop + page.offsetHeight / 2;
      const nextDistance = Math.abs(midpoint - readerMidpoint);
      if (nextDistance < distance) {
        closest = page;
        distance = nextDistance;
      }
    });
    onPageChange(Number(closest.dataset.page));
  }

  if (!url) {
    return <div style={{ height: "100%", background: "linear-gradient(180deg, var(--surface2), var(--surface))", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}><div className="tp-mono" style={{ fontSize: 11, color: "var(--faint)" }}>PDF VIEWER</div><div style={{ fontSize: 12, color: "var(--faint)" }}>No PDF has been added to this course yet.</div></div>;
  }

  return (
    <div ref={scrollRef} onScroll={trackPage} style={{ height: "min(72vh, 860px)", minHeight: 520, overflowY: "auto", background: "#30343b", padding: 16 }} aria-label={`${title} PDF reader`}>
      {status === "loading" && <div style={{ color: "white", textAlign: "center", padding: 48 }}>Loading PDF…</div>}
      {status === "error" && <div style={{ color: "white", textAlign: "center", padding: 48 }}>Unable to load this PDF. {error}</div>}
      <div ref={pagesRef} style={{ display: status === "ready" ? "flex" : "none", flexDirection: "column", alignItems: "center", gap: 16 }} />
    </div>
  );
}
