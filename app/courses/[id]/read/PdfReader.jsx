"use client";

import { useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import Skeleton from "@/components/Skeleton";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();

export default function PdfReader({ url, title, onPageChange }) {
  const scrollRef = useRef(null);
  const pagesRef = useRef(null);
  const renderRunRef = useRef(0);
  const currentPageRef = useRef(1);
  const panRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [pdfDocument, setPdfDocument] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let loadingTask;

    async function loadPdf() {
      setStatus("loading");
      setError("");
      try {
        loadingTask = getDocument({ url });
        const loadedDocument = await loadingTask.promise;
        if (!cancelled) setPdfDocument(loadedDocument);
      } catch (cause) {
        if (!cancelled) {
          setError(cause.message || "The PDF could not be loaded.");
          setStatus("error");
        }
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
      renderRunRef.current += 1;
      setPdfDocument(null);
      loadingTask?.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (!pdfDocument) return;
    const run = ++renderRunRef.current;

    async function renderPdf() {
      const pageContainer = pagesRef.current;
      const reader = scrollRef.current;
      if (!pageContainer || !reader) return;
      setStatus("loading");
      setError("");
      pageContainer.replaceChildren();
      const availableWidth = Math.max(reader.clientWidth - 32, 320);

      try {
        for (let number = 1; number <= pdfDocument.numPages; number += 1) {
          const page = await pdfDocument.getPage(number);
          if (renderRunRef.current !== run) return;
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = (availableWidth / baseViewport.width) * zoom;
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
          if (renderRunRef.current !== run) return;
        }

        setStatus("ready");
        requestAnimationFrame(() => {
          const currentPage = pageContainer.querySelector(`[data-page="${currentPageRef.current}"]`);
          if (currentPage) reader.scrollTop = currentPage.offsetTop - 16;
        });
      } catch (cause) {
        if (renderRunRef.current === run) {
          setError(cause.message || "The PDF could not be rendered.");
          setStatus("error");
        }
      }
    }

    renderPdf();
    return () => {
      if (renderRunRef.current === run) renderRunRef.current += 1;
    };
  }, [pdfDocument, zoom]);

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
    const pageNumber = Number(closest.dataset.page);
    currentPageRef.current = pageNumber;
    onPageChange(pageNumber);
  }

  function startPan(event) {
    const reader = scrollRef.current;
    if (zoom <= 1 || status !== "ready" || !reader || !event.target.closest("[data-page]")) return;
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: reader.scrollLeft,
      scrollTop: reader.scrollTop,
    };
    reader.setPointerCapture(event.pointerId);
    setIsPanning(true);
  }

  function panDocument(event) {
    const reader = scrollRef.current;
    const pan = panRef.current;
    if (!reader || !pan || pan.pointerId !== event.pointerId) return;
    event.preventDefault();
    reader.scrollLeft = pan.scrollLeft - (event.clientX - pan.x);
    reader.scrollTop = pan.scrollTop - (event.clientY - pan.y);
  }

  function stopPan(event) {
    const reader = scrollRef.current;
    if (!panRef.current || panRef.current.pointerId !== event.pointerId) return;
    if (reader?.hasPointerCapture(event.pointerId)) reader.releasePointerCapture(event.pointerId);
    panRef.current = null;
    setIsPanning(false);
  }

  if (!url) {
    return <div style={{ height: "100%", background: "linear-gradient(180deg, var(--surface2), var(--surface))", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}><div className="tp-mono" style={{ fontSize: 11, color: "var(--faint)" }}>PDF VIEWER</div><div style={{ fontSize: 12, color: "var(--faint)" }}>No PDF has been added to this course yet.</div></div>;
  }

  return (
    <div style={{ background: "#30343b" }}>
      <div style={{ height: 44, padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, borderBottom: "1px solid rgba(255,255,255,.12)", background: "#25282e", boxSizing: "border-box" }} aria-label="PDF zoom controls">
        <button type="button" className="tp-btn tp-btn-ghost" style={{ padding: "5px 10px", color: "white", borderColor: "rgba(255,255,255,.2)" }} aria-label="Zoom out" disabled={status !== "ready" || zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}>−</button>
        <button type="button" className="tp-btn tp-btn-ghost tp-mono" style={{ padding: "5px 10px", minWidth: 64, color: "white", borderColor: "rgba(255,255,255,.2)" }} aria-label="Reset zoom" disabled={status !== "ready" || zoom === 1} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
        <button type="button" className="tp-btn tp-btn-ghost" style={{ padding: "5px 10px", color: "white", borderColor: "rgba(255,255,255,.2)" }} aria-label="Zoom in" disabled={status !== "ready" || zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + 0.25))}>+</button>
      </div>
      <div
        ref={scrollRef}
        onScroll={trackPage}
        onPointerDown={startPan}
        onPointerMove={panDocument}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
        style={{ height: "min(82vh, 960px)", minHeight: 640, overflow: "auto", cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "auto", userSelect: isPanning ? "none" : "auto", overscrollBehavior: "contain" }}
        aria-label={`${title} PDF reader`}
      >
        {status === "loading" && (
          <div className="pdf-loading-skeleton" aria-busy="true" aria-label="Loading PDF">
            <Skeleton className="pdf-loading-page" />
            <span className="tp-sr-only" role="status">Loading PDF…</span>
          </div>
        )}
        {status === "error" && <div style={{ color: "white", textAlign: "center", padding: 48 }}>Unable to load this PDF. {error}</div>}
        <div ref={pagesRef} style={{ display: status === "ready" ? "flex" : "none", flexDirection: "column", alignItems: "center", gap: 16, minWidth: "100%", width: "max-content", padding: 16, boxSizing: "border-box" }} />
      </div>
      <style jsx>{`
        .pdf-loading-skeleton { min-height: 100%; padding: 20px; display: flex; justify-content: center; }
        :global(.pdf-loading-page) { width: min(78%, 620px); height: min(72vh, 860px); min-height: 560px; border-radius: 2px; background: #eef1f5; }
      `}</style>
    </div>
  );
}
