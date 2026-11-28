"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import Skeleton from "@/components/Skeleton";
import { loadPdfjs } from "@/components/pdfjs";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
// Pinch zoom previews instantly with a CSS scale, then re-draws the pages sharply once the
// fingers stop for this long.
const PINCH_SETTLE_MS = 220;
// Keep each page canvas within what browsers draw reliably (and within memory) at high zoom.
const MAX_CANVAS_SIDE = 4096;
const noSubscribe = () => () => {};
const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
// The + and − buttons move between 25% steps, so after a pinch they land back on round numbers.
const stepZoom = (zoom, direction) => clampZoom(direction > 0
  ? (Math.floor(zoom / ZOOM_STEP + 1e-6) + 1) * ZOOM_STEP
  : (Math.ceil(zoom / ZOOM_STEP - 1e-6) - 1) * ZOOM_STEP);

function ToolbarButton({ children, className = "", ...props }) {
  return <button type="button" className={`pdf-toolbar-button ${className}`} {...props}>{children}</button>;
}

// In full screen the rest of the reading page is hidden, so the page passes `fullscreenPanel`
// (the open reading question) to show beside the pages, and `fullscreenStatus` (time left).
export default function PdfReader({ url, title, onPageChange, fullscreenPanel = null, fullscreenStatus = "" }) {
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
  const shellRef = useRef(null);
  const canFullscreen = useSyncExternalStore(
    noSubscribe,
    () => Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled),
    () => false,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pageCount = pdfDocument?.numPages || 0;
  const sidePanel = isFullscreen && fullscreenPanel ? fullscreenPanel : null;
  const hasSidePanel = Boolean(sidePanel);

  // Fullscreen uses the browser's own API (Esc also exits). iPhone Safari has no element
  // fullscreen, so the button is hidden there and "Open PDF" remains the way to go big.
  useEffect(() => {
    function syncFullscreen() {
      const element = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(Boolean(element) && element === shellRef.current);
    }
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
    };
  }, []);

  function toggleFullscreen() {
    const shell = shellRef.current;
    if (!shell) return;
    if (isFullscreen) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      const request = shell.requestFullscreen || shell.webkitRequestFullscreen;
      Promise.resolve(request?.call(shell)).catch(() => {});
    }
  }

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
          const outputScale = Math.min(window.devicePixelRatio || 1, 2, MAX_CANVAS_SIDE / Math.max(viewport.width, viewport.height));
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
    // Full screen and the question panel change the reader's width, so pages are re-rendered to fit.
  }, [pdfDocument, zoom, isFullscreen, hasSidePanel]);

  // Pinch to zoom: a trackpad pinch arrives as a wheel event with ctrlKey (Chrome, Edge, Firefox,
  // Safari), a touch screen pinch as two touches. While the gesture runs the pages are scaled with
  // CSS; when it settles the zoom is committed and the pages are re-drawn at the new size.
  const zoomRef = useRef(zoom);
  const pinchRef = useRef({ target: null, timer: 0, touchStart: null });
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const previewZoom = useEffectEvent((target) => {
    const pinch = pinchRef.current;
    const pages = pagesRef.current;
    if (!pages || status !== "ready") return;
    pinch.target = clampZoom(target);
    pages.style.transformOrigin = "top center";
    pages.style.transform = `scale(${pinch.target / zoomRef.current})`;
    window.clearTimeout(pinch.timer);
    pinch.timer = window.setTimeout(() => {
      if (pagesRef.current) pagesRef.current.style.transform = "";
      if (pinch.target !== null) setZoom(Math.round(pinch.target * 100) / 100);
      pinch.target = null;
    }, PINCH_SETTLE_MS);
  });

  useEffect(() => {
    const reader = scrollRef.current;
    if (!reader) return;
    const pinch = pinchRef.current;
    const touchDistance = (touches) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

    function onWheel(event) {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const from = pinch.target ?? zoomRef.current;
      previewZoom(from * Math.exp(-event.deltaY * 0.01));
    }
    function onTouchStart(event) {
      if (event.touches.length !== 2) return;
      pinch.touchStart = { distance: touchDistance(event.touches), zoom: pinch.target ?? zoomRef.current };
    }
    function onTouchMove(event) {
      if (event.touches.length !== 2 || !pinch.touchStart) return;
      event.preventDefault();
      previewZoom(pinch.touchStart.zoom * (touchDistance(event.touches) / pinch.touchStart.distance));
    }
    function onTouchEnd(event) {
      if (event.touches.length < 2) pinch.touchStart = null;
    }

    reader.addEventListener("wheel", onWheel, { passive: false });
    reader.addEventListener("touchstart", onTouchStart, { passive: true });
    reader.addEventListener("touchmove", onTouchMove, { passive: false });
    reader.addEventListener("touchend", onTouchEnd);
    reader.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.clearTimeout(pinch.timer);
      reader.removeEventListener("wheel", onWheel);
      reader.removeEventListener("touchstart", onTouchStart);
      reader.removeEventListener("touchmove", onTouchMove);
      reader.removeEventListener("touchend", onTouchEnd);
      reader.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

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
        <strong>No course material yet</strong>
        <span>Check back later.</span>
      </div>
    );
  }

  return (
    <div ref={shellRef} className={`pdf-viewer-shell${isFullscreen ? " is-fullscreen" : ""}`}>
      <div className="pdf-toolbar">
        <div className="pdf-document-meta">
          <div className="pdf-document-icon" aria-hidden="true">PDF</div>
          <div className="pdf-document-copy">
            <strong title={title}>{title}</strong>
            <span>
              {pageCount ? `${pageCount} page${pageCount === 1 ? "" : "s"}` : "Preparing document…"}
              {isFullscreen && fullscreenStatus && <b className="pdf-fullscreen-status"> · {fullscreenStatus}</b>}
            </span>
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
            <ToolbarButton aria-label="Zoom out" title="Zoom out (or pinch)" disabled={status !== "ready" || zoom <= MIN_ZOOM} onClick={() => setZoom((value) => stepZoom(value, -1))}>−</ToolbarButton>
            <ToolbarButton className="pdf-zoom-value" aria-label="Fit page to width" title="Fit to width" disabled={status !== "ready" || zoom === 1} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</ToolbarButton>
            <ToolbarButton aria-label="Zoom in" title="Zoom in (or pinch)" disabled={status !== "ready" || zoom >= MAX_ZOOM} onClick={() => setZoom((value) => stepZoom(value, 1))}>+</ToolbarButton>
          </div>
          {canFullscreen && (
            <button type="button" className="pdf-open-link pdf-fullscreen-button" onClick={toggleFullscreen} aria-pressed={isFullscreen} title={isFullscreen ? "Exit full screen (Esc)" : "View full screen"}>
              {isFullscreen ? "Exit full screen" : "Full screen"} <span aria-hidden="true">{isFullscreen ? "⤡" : "⤢"}</span>
            </button>
          )}
          <a className="pdf-open-link" href={url} target="_blank" rel="noreferrer" title="Open the original PDF in a new tab">Open PDF <span aria-hidden="true">↗</span></a>
        </div>
      </div>

      <div className="pdf-progress-track" aria-hidden="true"><span style={{ width: pageCount ? `${(currentPage / pageCount) * 100}%` : "0%" }} /></div>

      <div className="pdf-stage">
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
      {sidePanel && <div className="pdf-fullscreen-panel">{sidePanel}</div>}
      </div>
    </div>
  );
}
