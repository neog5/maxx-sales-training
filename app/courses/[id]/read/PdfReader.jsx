"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Skeleton from "@/components/Skeleton";
import { loadPdfjs } from "@/components/pdfjs";

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
        const { getDocument } = await loadPdfjs();
        if (cancelled) return;
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

  // After a re-render (new document or zoom), return to the page being read.
  const restoreScroll = useEffectEvent(() => scrollToPage(currentPageRef.current, "auto"));

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
        requestAnimationFrame(restoreScroll);
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
      <div className="pdf-empty-state">
        <div className="pdf-state-icon" aria-hidden="true">▤</div>
        <strong>No document yet</strong>
        <span>No PDF has been added to this course.</span>
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
        className={`pdf-scroll-region ${zoom > 1 ? "is-pannable" : ""} ${isPanning ? "is-panning" : ""}`}
        onScroll={trackPage}
        onPointerDown={startPan}
        onPointerMove={panDocument}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
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
        <div ref={pagesRef} className={status === "ready" ? "pdf-pages is-ready" : "pdf-pages"} />
      </div>
    </div>
  );
}
