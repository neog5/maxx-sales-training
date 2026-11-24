"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration, reachedEnd } from "@/lib/course-materials";

const SPEEDS = [1, 1.25, 1.5, 2];

// Plays one course video with the browser's own player. Learners may skip ahead or back;
// onWatched fires once playback reaches the end, by playing or by skipping there.
export default function VideoReader({ url, title, watched, onWatched }) {
  const videoRef = useRef(null);
  const reportedRef = useRef(false);
  const [speed, setSpeed] = useState(1);
  const [position, setPosition] = useState({ current: 0, duration: 0 });
  const [failed, setFailed] = useState(false);

  function track() {
    const video = videoRef.current;
    if (!video) return;
    setPosition({ current: video.currentTime, duration: video.duration || 0 });
    if (!reportedRef.current && reachedEnd(video.currentTime, video.duration)) {
      reportedRef.current = true;
      onWatched?.();
    }
  }

  // The page is server-rendered, so the browser can load the video before React attaches its
  // listeners and the first loadedmetadata event is missed. Catch up once on mount.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 1) return;
    video.playbackRate = 1;
    const frame = requestAnimationFrame(() => setPosition({ current: video.currentTime, duration: video.duration || 0 }));
    return () => cancelAnimationFrame(frame);
  }, []);

  function changeSpeed(value) {
    setSpeed(value);
    if (videoRef.current) videoRef.current.playbackRate = value;
  }

  if (!url) {
    return (
      <div className="pdf-empty-state">
        <div className="pdf-state-icon" aria-hidden="true">▶</div>
        <strong>This video isn’t available</strong>
        <span>Refresh the page to try again. If it still won’t load, contact your administrator.</span>
      </div>
    );
  }

  const { current, duration } = position;

  return (
    <div className="pdf-viewer-shell video-viewer-shell">
      <div className="pdf-toolbar">
        <div className="pdf-document-meta">
          <div className="pdf-document-icon" aria-hidden="true">▶</div>
          <div className="pdf-document-copy">
            <strong title={title}>{title}</strong>
            <span>{watched ? "Watched" : duration ? `${formatDuration(current) || "0:00"} / ${formatDuration(duration)}` : "Loading video…"}</span>
          </div>
        </div>
        <div className="pdf-toolbar-actions">
          <div className="pdf-control-group" role="group" aria-label="Playback speed">
            {SPEEDS.map((value) => (
              <button key={value} type="button" className={`pdf-toolbar-button video-speed${speed === value ? " is-active" : ""}`} aria-pressed={speed === value} onClick={() => changeSpeed(value)}>
                {value}×
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pdf-progress-track" aria-hidden="true"><span style={{ width: duration ? `${Math.min(100, (current / duration) * 100)}%` : "0%" }} /></div>

      {failed ? (
        <div className="pdf-error-state" role="alert">
          <div className="pdf-state-icon" aria-hidden="true">!</div>
          <strong>We couldn’t play this video</strong>
          <span>Check your connection, then try again. Links expire after a few hours, so refreshing the page can also help.</span>
          <button type="button" className="pdf-retry-button" onClick={() => { setFailed(false); videoRef.current?.load(); }}>Try again</button>
        </div>
      ) : null}
      <div className="video-stage" hidden={failed}>
        <video
          ref={videoRef}
          src={url}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          onContextMenu={(event) => event.preventDefault()}
          onLoadedMetadata={(event) => { event.currentTarget.playbackRate = speed; track(); }}
          onTimeUpdate={track}
          onSeeked={track}
          onEnded={track}
          onError={() => setFailed(true)}
          aria-label={`${title} video`}
        />
      </div>
    </div>
  );
}
