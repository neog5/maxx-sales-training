"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const STATUS_LABELS = {
  "on-track": "On track",
  "needs-attention": "Needs attention",
  "not-started": "Not started",
};

const STATUS_ORDER = {
  "needs-attention": 0,
  "not-started": 1,
  "on-track": 2,
};

function formatDate(value) {
  if (!value) return "No activity";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function PeopleDirectoryClient({ people, initialStatus = "all" }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState(initialStatus);
  const [sort, setSort] = useState("attention");

  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return people
      .filter((person) => {
        const matchesQuery = !normalizedQuery
          || person.full_name?.toLocaleLowerCase().includes(normalizedQuery);
        return matchesQuery
          && (role === "all" || person.role === role)
          && (status === "all" || person.attentionStatus === status);
      })
      .sort((a, b) => {
        if (sort === "name") return a.full_name.localeCompare(b.full_name);
        if (sort === "recent") {
          return (Date.parse(b.lastActiveAt || 0) || 0) - (Date.parse(a.lastActiveAt || 0) || 0);
        }
        if (sort === "score") return (b.averageScore ?? -1) - (a.averageScore ?? -1);
        return STATUS_ORDER[a.attentionStatus] - STATUS_ORDER[b.attentionStatus]
          || a.full_name.localeCompare(b.full_name);
      });
  }, [people, query, role, status, sort]);

  const attentionCount = people.filter((person) => person.attentionStatus === "needs-attention").length;
  const notStartedCount = people.filter((person) => person.attentionStatus === "not-started").length;

  function clearFilters() {
    setQuery("");
    setRole("all");
    setStatus("all");
    setSort("attention");
  }

  return (
    <main className="tp-page people-page tp-fade-in">
      <div className="page-heading people-heading">
        <div>
          <div className="tp-label">Team management</div>
          <h1 className="tp-display">People</h1>
          <p>Find team members, review training performance, and open profiles to manage access.</p>
        </div>
        <div className="people-summary" aria-label="Team summary">
          <span><strong>{people.length}</strong> people</span>
          <span><strong>{attentionCount}</strong> need attention</span>
          <span><strong>{notStartedCount}</strong> not started</span>
        </div>
      </div>

      <section className="tp-card directory-toolbar" aria-label="Directory filters">
        <label className="directory-search">
          <span className="tp-sr-only">Search people</span>
          <span className="directory-search__icon" aria-hidden="true">⌕</span>
          <input
            className="tp-input"
            type="search"
            placeholder="Search by name…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span className="tp-sr-only">Filter by role</span>
          <select className="tp-input" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="all">All roles</option>
            <option value="rep">Reps</option>
            <option value="admin">Admins</option>
          </select>
        </label>
        <label>
          <span className="tp-sr-only">Filter by training status</span>
          <select className="tp-input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="needs-attention">Needs attention</option>
            <option value="not-started">Not started</option>
            <option value="on-track">On track</option>
          </select>
        </label>
        <label>
          <span className="tp-sr-only">Sort people</span>
          <select className="tp-input" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="attention">Attention first</option>
            <option value="name">Name</option>
            <option value="recent">Recent activity</option>
            <option value="score">Average score</option>
          </select>
        </label>
      </section>

      <div className="directory-result-count" role="status">
        Showing {filteredPeople.length} of {people.length} people
      </div>

      <section className="tp-card people-table">
        <div className="people-table__head">
          <div>Person</div><div>Role</div><div>Training status</div><div>Attempts</div><div>Performance</div><div>Last active</div><div></div>
        </div>
        <div className="tp-scroll people-table__body">
          {filteredPeople.map((person) => (
            <article className="people-table__row" key={person.id}>
              <div className="people-identity">
                <span className="people-avatar" aria-hidden="true">{person.full_name?.trim()?.charAt(0)?.toUpperCase() || "U"}</span>
                <span>
                  <Link className="profile-link" href={`/profile/${person.id}`}>{person.full_name}</Link>
                  <small>{person.attemptCount === 0 ? "No completed training" : `${person.attemptCount} completed ${person.attemptCount === 1 ? "attempt" : "attempts"}`}</small>
                </span>
              </div>
              <div><span className={`tp-badge role-badge role-badge--${person.role}`}>{person.role}</span></div>
              <div>
                <span
                  className={`training-status training-status--${person.attentionStatus}`}
                  title={person.attentionStatus === "not-started" ? "No completed attempts" : "Based on the latest completed attempt"}
                >
                  <span aria-hidden="true"></span>{STATUS_LABELS[person.attentionStatus]}
                </span>
              </div>
              <div className="tp-mono">{person.attemptCount}</div>
              <div className="people-performance">
                <span className="tp-mono">{person.averageScore === null ? "—" : `${person.averageScore}%`}</span>
                {person.passRate !== null && <small>{person.passRate}% pass</small>}
              </div>
              <div className="people-last-active">{formatDate(person.lastActiveAt)}</div>
              <div><Link href={`/profile/${person.id}`} className="tp-btn tp-btn-ghost people-view-link">View</Link></div>
            </article>
          ))}
          {filteredPeople.length === 0 && (
            <div className="directory-empty">
              <strong>No people match these filters.</strong>
              <span>Try a different search or clear the filters.</span>
              <button type="button" className="tp-btn tp-btn-ghost" onClick={clearFilters}>Clear filters</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
