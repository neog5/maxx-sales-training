"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import LocalDate from "@/components/LocalDate";
import PersonIdentity from "@/components/PersonIdentity";
import SearchField from "@/components/SearchField";
import { ATTENTION_LABELS, ATTENTION_STATUSES } from "@/lib/attempt-stats";
import { byName } from "@/lib/people";
import { ROLE_LABELS, VISIBLE_ROLES, visibleRole } from "@/lib/roles";
import { routes } from "@/lib/routes";
import InvitePanel from "./InvitePanel";

// Each column's natural order; clicking the same header again reverses it.
const SORTS = {
  attention: (a, b) => ATTENTION_STATUSES.indexOf(a.attentionStatus) - ATTENTION_STATUSES.indexOf(b.attentionStatus) || byName(a, b),
  name: byName,
  role: (a, b) => (ROLE_LABELS[a.role] || "").localeCompare(ROLE_LABELS[b.role] || "") || byName(a, b),
  attempts: (a, b) => b.attemptCount - a.attemptCount || byName(a, b),
  score: (a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1) || byName(a, b),
  recent: (a, b) => (Date.parse(b.lastActiveAt || 0) || 0) - (Date.parse(a.lastActiveAt || 0) || 0) || byName(a, b),
};

function SortHeader({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  return (
    <div aria-sort={active ? (sort.reversed ? "descending" : "ascending") : undefined}>
      <button type="button" className={`sort-header${active ? " is-active" : ""}`} onClick={() => onSort(sortKey)} title={`Sort by ${label.toLowerCase()}`}>
        {label}<span aria-hidden="true">{active ? (sort.reversed ? " ↑" : " ↓") : ""}</span>
      </button>
    </div>
  );
}

// `people` includes archived people; they show only under the "Archived" status filter.
// `invites` is the list of unused invites.
export default function PeopleDirectoryClient({ people: everyone, initialStatus = "all", invites = null, groups = [] }) {
  const people = useMemo(() => everyone.filter((person) => !person.archived_at), [everyone]);
  const archivedPeople = useMemo(() => everyone.filter((person) => person.archived_at), [everyone]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState(initialStatus);
  const [sort, setSort] = useState({ key: "attention", reversed: false });
  const sortBy = (key) => setSort((current) => ({ key, reversed: current.key === key ? !current.reversed : false }));

  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return (status === "archived" ? archivedPeople : people)
      .filter((person) => {
        const matchesQuery = !normalizedQuery
          || `${person.full_name || ""} ${person.email || ""}`.toLocaleLowerCase().includes(normalizedQuery);
        return matchesQuery
          && (role === "all" || visibleRole(person.role) === role)
          && (status === "all" || status === "archived" || person.attentionStatus === status);
      })
      .sort((a, b) => (sort.reversed ? -1 : 1) * SORTS[sort.key](a, b));
  }, [people, archivedPeople, query, role, status, sort]);

  const attentionCount = people.filter((person) => person.attentionStatus === "needs-attention").length;
  const notStartedCount = people.filter((person) => person.attentionStatus === "not-started").length;

  function clearFilters() {
    setQuery("");
    setRole("all");
    setStatus("all");
    setSort({ key: "attention", reversed: false });
  }

  return (
    <main className="tp-page people-page tp-fade-in">
      <div className="page-heading people-heading">
        <div>
          <h1 className="tp-display">People</h1>
        </div>
        <div className="people-summary" aria-label="Team summary">
          <span><strong>{people.length}</strong> people</span>
          <span><strong>{attentionCount}</strong> need attention</span>
          <span><strong>{notStartedCount}</strong> not started</span>
        </div>
      </div>

      {invites && <InvitePanel invites={invites} groups={groups} existingEmails={everyone.map((person) => person.email)} />}

      <section className="tp-card directory-toolbar" aria-label="Directory filters">
        <SearchField value={query} onChange={setQuery} />
        <label>
          <span className="tp-sr-only">Filter by role</span>
          <select className="tp-input" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="all">All roles</option>
            {VISIBLE_ROLES.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}
          </select>
        </label>
        <label>
          <span className="tp-sr-only">Filter by training status</span>
          <select className="tp-input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All active people</option>
            {ATTENTION_STATUSES.map((value) => <option key={value} value={value}>{ATTENTION_LABELS[value]}</option>)}
            <option value="archived">Archived ({archivedPeople.length})</option>
          </select>
        </label>
      </section>

      <div className="directory-result-count" role="status">
        {status === "archived" ? `Showing ${filteredPeople.length} of ${archivedPeople.length} archived people` : `Showing ${filteredPeople.length} of ${people.length} people`}
      </div>

      <section className="tp-card people-table">
        <div className="people-table__head">
          <SortHeader label="Person" sortKey="name" sort={sort} onSort={sortBy} />
          <SortHeader label="Role" sortKey="role" sort={sort} onSort={sortBy} />
          <SortHeader label="Training status" sortKey="attention" sort={sort} onSort={sortBy} />
          <SortHeader label="Attempts" sortKey="attempts" sort={sort} onSort={sortBy} />
          <SortHeader label="Performance" sortKey="score" sort={sort} onSort={sortBy} />
          <SortHeader label="Last active" sortKey="recent" sort={sort} onSort={sortBy} />
          <div></div>
        </div>
        <div className="tp-scroll people-table__body">
          {filteredPeople.map((person) => (
            <article className="people-table__row" key={person.id}>
              <PersonIdentity person={person}>
                {person.email}
              </PersonIdentity>
              <div><span className={`tp-badge role-badge role-badge--${visibleRole(person.role)}`}>{ROLE_LABELS[person.role] || person.role}</span></div>
              <div>
                {person.archived_at ? <span className="tp-badge">Archived <LocalDate value={person.archived_at} /></span> : <span
                  className={`training-status training-status--${person.attentionStatus}`}
                  title={person.attentionStatus === "not-started" ? "No completed attempts on required courses" : "Based on the latest completed attempt on a required course"}
                >
                  <span aria-hidden="true"></span>{ATTENTION_LABELS[person.attentionStatus]}
                </span>}
              </div>
              <div className="tp-mono">{person.attemptCount}</div>
              <div className="people-performance">
                <span className="tp-mono">{person.averageScore === null ? "—" : `${person.averageScore}%`}</span>
                {person.passRate !== null && <small>{person.passRate}% pass</small>}
              </div>
              <div className="people-last-active">{person.lastActiveAt ? <LocalDate value={person.lastActiveAt} /> : "No activity"}</div>
              <div><Link href={routes.profile(person.id)} className="tp-btn tp-btn-ghost people-view-link">View</Link></div>
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
