"use client";

// Shown when a page fails to load its data (see lib/db.js `must`).
export default function Error({ error, reset }) {
  return (
    <main className="tp-page tp-page-narrow error-page">
      <div className="tp-card error-page__card" role="alert">
        <div className="tp-label">Something went wrong</div>
        <h1 className="tp-display">We couldn’t load this page.</h1>
        <p>{error?.message || "Please try again in a moment."}</p>
        <button type="button" className="tp-btn tp-btn-primary" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
