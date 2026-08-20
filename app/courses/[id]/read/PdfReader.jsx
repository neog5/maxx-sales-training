"use client";

import { useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import Skeleton from "@/components/Skeleton";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;

function ToolbarButton({ children, className = "", ...props }) {
  return <button type="button" className={`pdf-toolbar-button ${className}`} {...props}>{children}</button>;
}

export default function PdfReader({ url, title, onPageChange }) {
  const scrollRef = useRef(null);
  const pagesRef = useRef(null);
  const renderRunRef = useRef(0);
  const currentPageRef = useRef(1);
  const panRef = useRef(null);
  const [status, setStatus] = useState(url ? "loading" : "empty");
  const [error, setError] = useState("");
  const [pdfDocument, setPdfDocument] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const pageCount = pdfDocument?.numPages || 0;

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
  }, [url, reloadKey]);

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
      const gutter = reader.clientWidth < 600 ? 24 : 56;
      const availableWidth = Math.max(reader.clientWidth - gutter, 280);

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
          pageElement.className = "pdf-page";
          pageElement.setAttribute("aria-label", `Page ${number} of ${pdfDocument.numPages}`);
          const pageLabel = document.createElement("span");
          pageLabel.className = "pdf-page-label";
          pageLabel.textContent = `${number}`;
          pageElement.append(canvas, pageLabel);
          pageContainer.append(pageElement);
          await page.render({ canvasContext: context, viewport, transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0] }).promise;
          if (renderRunRef.current !== run) return;
        }

        setStatus("ready");
        requestAnimationFrame(() => scrollToPage(currentPageRef.current, "auto"));
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

  function selectPage(pageNumber) {
    if (pageNumber === currentPageRef.current) return;
    currentPageRef.current = pageNumber;
    setCurrentPage(pageNumber);
    onPageChange(pageNumber);
  }

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
    selectPage(Number(closest.dataset.page));
  }

  function scrollToPage(pageNumber, behavior = "smooth") {
    const reader = scrollRef.current;
    const page = pagesRef.current?.querySelector(`[data-page="${pageNumber}"]`);
    if (!reader || !page) return;
    reader.scrollTo({ top: Math.max(page.offsetTop - 20, 0), behavior });
    selectPage(pageNumber);
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
    return (
      <div style={{ minHeight: 500, padding: 42, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", background: "linear-gradient(180deg, #edf2f6, #e4eaf0)", color: "#1a355c", textAlign: "center" }}>
        <div aria-hidden="true" style={{ width: 46, height: 46, marginBottom: 13, display: "grid", placeItems: "center", border: "1px solid #cbd5e1", borderRadius: 13, background: "#fff", color: "#dd8b32", boxShadow: "0 7px 18px rgba(26,53,92,.09)", font: "700 18px/1 'JetBrains Mono', monospace" }}>▤</div>
        <strong>No document yet</strong>
        <span style={{ marginTop: 5, color: "#687a90", fontSize: 12 }}>No PDF has been added to this course.</span>
      </div>
    );
  }

  return (
    <div className="pdf-viewer-shell">
      <div className="pdf-toolbar">
        <div className="pdf-document-meta">
          <div className="pdf-document-icon" aria-hidden="true">PDF</div>
          <div className="pdf-document-copy">
            <strong title={title}>{title}</strong>
            <span>{pageCount ? `${pageCount} page${pageCount === 1 ? "" : "s"}` : "Preparing document…"}</span>
          </div>
        </div>

        <div className="pdf-toolbar-actions" aria-label="PDF controls">
          <div className="pdf-control-group" aria-label="Page navigation">
            <ToolbarButton aria-label="Previous page" title="Previous page" disabled={status !== "ready" || currentPage <= 1} onClick={() => scrollToPage(currentPage - 1)}>‹</ToolbarButton>
            <span className="pdf-page-counter" aria-live="polite"><b>{currentPage}</b><span>/</span>{pageCount || "—"}</span>
            <ToolbarButton aria-label="Next page" title="Next page" disabled={status !== "ready" || currentPage >= pageCount} onClick={() => scrollToPage(currentPage + 1)}>›</ToolbarButton>
          </div>
          <div className="pdf-toolbar-divider" />
          <div className="pdf-control-group" aria-label="Zoom controls">
            <ToolbarButton aria-label="Zoom out" title="Zoom out" disabled={status !== "ready" || zoom <= MIN_ZOOM} onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))}>−</ToolbarButton>
            <ToolbarButton className="pdf-zoom-value" aria-label="Fit page to width" title="Fit to width" disabled={status !== "ready" || zoom === 1} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</ToolbarButton>
            <ToolbarButton aria-label="Zoom in" title="Zoom in" disabled={status !== "ready" || zoom >= MAX_ZOOM} onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))}>+</ToolbarButton>
          </div>
          <a className="pdf-open-link" href={url} target="_blank" rel="noreferrer" title="Open the original PDF in a new tab">Open PDF <span aria-hidden="true">↗</span></a>
        </div>
      </div>

      <div className="pdf-progress-track" aria-hidden="true"><span style={{ width: pageCount ? `${(currentPage / pageCount) * 100}%` : "0%" }} /></div>

      <div
        ref={scrollRef}
        className="pdf-scroll-region"
        onScroll={trackPage}
        onPointerDown={startPan}
        onPointerMove={panDocument}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
        style={{ cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "auto", userSelect: isPanning ? "none" : "auto" }}
        aria-label={`${title} PDF reader`}
      >
        {status === "loading" && (
          <div className="pdf-loading-skeleton" aria-busy="true" aria-label="Loading PDF">
            <div className="pdf-loading-copy"><span className="pdf-loading-spinner" /><span>Preparing your document…</span></div>
            <Skeleton className="pdf-loading-page" />
            <span className="tp-sr-only" role="status">Loading PDF…</span>
          </div>
        )}
        {status === "error" && (
          <div className="pdf-error-state" role="alert">
            <div className="pdf-state-icon" aria-hidden="true">!</div>
            <strong>We couldn’t display this PDF</strong>
            <span>{error}</span>
            <button type="button" className="pdf-retry-button" onClick={() => setReloadKey((value) => value + 1)}>Try again</button>
          </div>
        )}
        <div ref={pagesRef} className="pdf-pages" style={{ display: status === "ready" ? "flex" : "none" }} />
      </div>

      <style jsx>{`
        .pdf-viewer-shell { overflow: hidden; background: #dfe5ec; color: #fff; }
        .pdf-toolbar { min-height: 62px; padding: 10px 12px 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border-bottom: 1px solid rgba(255,255,255,.08); background: #172b46; }
        .pdf-document-meta { min-width: 0; display: flex; align-items: center; gap: 10px; }
        .pdf-document-icon { width: 34px; height: 38px; display: grid; place-items: center; flex: 0 0 auto; border: 1px solid rgba(255,255,255,.2); border-radius: 7px; background: rgba(255,255,255,.09); color: #f4b46f; font: 700 9px/1 'JetBrains Mono', monospace; letter-spacing: .08em; }
        .pdf-document-copy { min-width: 0; display: flex; flex-direction: column; }
        .pdf-document-copy strong { max-width: 260px; overflow: hidden; color: #fff; font-size: 12.5px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
        .pdf-document-copy span { margin-top: 2px; color: #aebed0; font-size: 10.5px; }
        .pdf-toolbar-actions, .pdf-control-group { display: flex; align-items: center; }
        .pdf-toolbar-actions { gap: 8px; }
        .pdf-control-group { overflow: hidden; border: 1px solid rgba(255,255,255,.16); border-radius: 7px; background: rgba(255,255,255,.06); }
        :global(.pdf-toolbar-button) { width: 31px; height: 30px; padding: 0; display: grid; place-items: center; border: 0; border-right: 1px solid rgba(255,255,255,.12); background: transparent; color: #edf3f8; cursor: pointer; font-size: 18px; line-height: 1; transition: background .15s, color .15s; }
        :global(.pdf-toolbar-button:last-child) { border-right: 0; }
        :global(.pdf-toolbar-button:hover:not(:disabled)) { background: rgba(255,255,255,.12); color: #fff; }
        :global(.pdf-toolbar-button:disabled) { color: rgba(255,255,255,.28); cursor: not-allowed; }
        :global(.pdf-zoom-value) { width: 52px; font: 600 10.5px/1 'JetBrains Mono', monospace; }
        .pdf-page-counter { min-width: 54px; height: 30px; padding: 0 7px; display: flex; align-items: center; justify-content: center; gap: 5px; border-right: 1px solid rgba(255,255,255,.12); color: #aebed0; font: 500 10.5px/1 'JetBrains Mono', monospace; }
        .pdf-page-counter b { color: #fff; font-weight: 600; }
        .pdf-toolbar-divider { width: 1px; height: 22px; margin: 0 1px; background: rgba(255,255,255,.13); }
        .pdf-open-link { height: 32px; padding: 0 10px; display: inline-flex; align-items: center; gap: 5px; border: 1px solid rgba(255,255,255,.16); border-radius: 7px; color: #dce7f1; font-size: 10.5px; font-weight: 650; text-decoration: none; white-space: nowrap; transition: background .15s, border-color .15s; }
        .pdf-open-link:hover { border-color: rgba(255,255,255,.3); background: rgba(255,255,255,.1); color: #fff; }
        .pdf-progress-track { height: 3px; background: #223d5e; }
        .pdf-progress-track span { height: 100%; display: block; background: #dd8b32; transition: width .2s ease; }
        .pdf-scroll-region { height: min(82vh, 960px); min-height: 640px; overflow: auto; overscroll-behavior: contain; scrollbar-color: #8e9bab transparent; scrollbar-width: thin; background-color: #dfe5ec; background-image: radial-gradient(rgba(26,53,92,.11) .7px, transparent .7px), linear-gradient(180deg, rgba(255,255,255,.42), transparent 150px); background-size: 16px 16px, 100% 100%; }
        .pdf-scroll-region::-webkit-scrollbar { width: 10px; height: 10px; }
        .pdf-scroll-region::-webkit-scrollbar-thumb { border: 3px solid transparent; border-radius: 10px; background: #8e9bab; background-clip: padding-box; }
        .pdf-pages { width: max-content; min-width: 100%; padding: 24px 28px 34px; box-sizing: border-box; flex-direction: column; align-items: center; gap: 24px; }
        :global(.pdf-page) { position: relative; overflow: hidden; flex: 0 0 auto; border-radius: 3px; background: #fff; box-shadow: 0 2px 3px rgba(26,39,55,.12), 0 16px 34px rgba(26,39,55,.2); line-height: 0; }
        :global(.pdf-page canvas) { display: block; }
        :global(.pdf-page-label) { position: absolute; right: 10px; bottom: 10px; min-width: 24px; height: 24px; padding: 0 7px; display: grid; place-items: center; border-radius: 999px; background: rgba(23,43,70,.78); color: #fff; font: 600 9.5px/1 'JetBrains Mono', monospace; box-shadow: 0 2px 7px rgba(0,0,0,.16); opacity: 0; transition: opacity .15s; }
        :global(.pdf-page:hover .pdf-page-label) { opacity: 1; }
        .pdf-loading-skeleton { min-height: 100%; padding: 20px; display: flex; flex-direction: column; align-items: center; }
        .pdf-loading-copy { height: 34px; margin-bottom: 12px; padding: 0 12px; display: flex; align-items: center; gap: 8px; border-radius: 999px; background: rgba(255,255,255,.82); color: #48617e; box-shadow: 0 5px 16px rgba(26,53,92,.1); font-size: 11px; font-weight: 600; }
        .pdf-loading-spinner { width: 13px; height: 13px; border: 2px solid #cbd5e1; border-top-color: #dd8b32; border-radius: 50%; animation: pdfSpin .75s linear infinite; }
        :global(.pdf-loading-page) { width: min(82%, 650px); height: min(70vh, 820px); min-height: 540px; border-radius: 3px; background: #f7f8fa; box-shadow: 0 16px 34px rgba(26,39,55,.14); }
        .pdf-empty-state, .pdf-error-state { min-height: 500px; padding: 42px; display: flex; align-items: center; justify-content: center; flex-direction: column; background: linear-gradient(180deg, #edf2f6, #e4eaf0); color: #1a355c; text-align: center; }
        .pdf-empty-state span, .pdf-error-state span { max-width: 440px; margin-top: 5px; color: #687a90; font-size: 12px; line-height: 1.5; }
        .pdf-state-icon { width: 46px; height: 46px; margin-bottom: 13px; display: grid; place-items: center; border: 1px solid #cbd5e1; border-radius: 13px; background: #fff; color: #dd8b32; box-shadow: 0 7px 18px rgba(26,53,92,.09); font: 700 18px/1 'JetBrains Mono', monospace; }
        .pdf-retry-button { margin-top: 16px; padding: 8px 14px; border: 0; border-radius: 7px; background: #1a355c; color: #fff; cursor: pointer; font-size: 11.5px; font-weight: 650; }
        @keyframes pdfSpin { to { transform: rotate(360deg); } }
        @media (max-width: 1100px) {
          .pdf-toolbar { align-items: stretch; flex-direction: column; }
          .pdf-document-meta { padding: 0 2px; }
          .pdf-document-copy strong { max-width: calc(100vw - 130px); }
          .pdf-toolbar-actions { justify-content: space-between; }
          .pdf-toolbar-divider { display: none; }
          .pdf-open-link { margin-left: auto; }
        }
        @media (max-width: 680px) {
          .pdf-scroll-region { min-height: 520px; height: 72vh; }
          .pdf-pages { padding: 14px 12px 28px; gap: 14px; }
        }
        @media (max-width: 430px) {
          .pdf-open-link { width: 32px; padding: 0; justify-content: center; font-size: 0; }
          .pdf-open-link span { font-size: 13px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pdf-progress-track span, :global(.pdf-page-label) { transition: none; }
          .pdf-loading-spinner { animation-duration: 1.5s; }
        }
      `}</style>
    </div>
  );
}
