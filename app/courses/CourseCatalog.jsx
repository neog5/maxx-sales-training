"use client";

import { useState } from "react";
import CourseCard from "./CourseCard";

const matches = (course, words) => {
  const text = `${course.code} ${course.title} ${course.description || ""}`.toLowerCase();
  return words.every((word) => text.includes(word));
};

function Section({ label, title, cards, empty }) {
  return (
    <section className="course-section">
      <div className="section-heading">
        <div>
          <div className="tp-label">{label}</div>
          <h2 className="tp-display">{title}</h2>
        </div>
      </div>
      {cards.length > 0
        ? <div className="course-list">{cards.map((card) => <CourseCard key={card.course.id} {...card} />)}</div>
        : <div className="tp-card courses-empty">{empty}</div>}
    </section>
  );
}

// The searchable course tiles. Each card is the props for CourseCard.
export default function CourseCatalog({ requiredCards, otherCards }) {
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const searching = words.length > 0;
  const required = requiredCards.filter((card) => matches(card.course, words));
  const other = otherCards.filter((card) => matches(card.course, words));
  const total = requiredCards.length + otherCards.length;

  if (total === 0) return <div className="tp-card courses-empty">No courses are available yet.</div>;

  return (
    <>
      <label className="course-search">
        <span className="tp-sr-only">Search courses</span>
        <span className="course-search__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </span>
        <input
          className="tp-input"
          type="search"
          placeholder="Search courses by name or code"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {searching && required.length + other.length === 0 ? (
        <div className="tp-card courses-empty">
          No courses match “{query.trim()}”.{" "}
          <button type="button" className="courses-empty__clear" onClick={() => setQuery("")}>Clear search</button>
        </div>
      ) : (
        <>
          {(!searching || required.length > 0) && (
            <Section
              label="Assigned to you"
              title="Required courses"
              cards={required}
              empty="No courses have been assigned to you yet."
            />
          )}
          {other.length > 0 && <Section label="Optional" title="Other courses" cards={other} />}
        </>
      )}
    </>
  );
}
