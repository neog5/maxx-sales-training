"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import LocalDate from "@/components/LocalDate";
import PersonIdentity from "@/components/PersonIdentity";
import SearchField from "@/components/SearchField";
import { ATTENTION_LABELS, ATTENTION_STATUSES } from "@/lib/attempt-stats";
import { byName } from "@/lib/people";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import { routes } from "@/lib/routes";
import InvitePanel from "./InvitePanel";

const SORTS = {
  attention: (a, b) => ATTENTION_STATUSES.indexOf(a.attentionStatus) - ATTENTION_STATUSES.indexOf(b.attentionStatus) || byName(a, b),
  name: byName,
  recent: (a, b) => (Date.parse(b.lastActiveAt || 0) || 0) - (Date.parse(a.lastActiveAt || 0) || 0),
  score: (a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1),
};

// `people` includes archived people; they show only under the "Archived" status filter.
// `invites` is the list of unused invites for admins, or null for managers.
export default function PeopleDirectoryClient({ people: everyone, initialStatus = "all", invites = null, groups = [] }) {
  const people = useMemo(() => everyone.filter((person) => !person.archived_at), [everyone]);
  const archivedPeople = useMemo(() => everyone.filter((person) => person.archived_at), [everyone]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState(initialStatus);
  const [sort, setSort] = useState("attention");

  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return (status === "archived" ? archivedPeople : people)
      .filter((person) => {
        const matchesQuery = !normalizedQuery
          || `${person.full_name || ""} ${person.email || ""}`.toLocaleLowerCase().includes(normalizedQuery);
        return matchesQuery
          && (role === "all" || person.role === role)
          && (status === "all" || status === "archived" || person.attentionStatus === status);
      })
      .sort(SORTS[sort]);
  }, [people, archivedPeople, query, role, status, sort]);

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
            {ROLES.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}
          </select>
        </label>
        <label>
          <span className="tp-sr-only">Filter by training status</span>
          <select className="tp-input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {ATTENTION_STATUSES.map((value) => <option key={value} value={value}>{ATTENTION_LABELS[value]}</option>)}
            <option value="archived">Archived ({archivedPeople.length})</option>
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
        {status === "archived" ? `Showing ${filteredPeople.length} of ${archivedPeople.length} archived people` : `Showing ${filteredPeople.length} of ${people.length} people`}
      </div>

      <section className="tp-card people-table">
        <div className="people-table__head">
          <div>Person</div><div>Role</div><div>Training status</div><div>Attempts</div><div>Performance</div><div>Last active</div><div></div>
        </div>
        <div className="tp-scroll people-table__body">
          {filteredPeople.map((person) => (
            <article className="people-table__row" key={person.id}>
              <PersonIdentity person={person}>
                {person.attemptCount === 0 ? "No completed training" : `${person.attemptCount} completed ${person.attemptCount === 1 ? "attempt" : "attempts"}`}
              </PersonIdentity>
              <div><span className={`tp-badge role-badge role-badge--${person.role}`}>{ROLE_LABELS[person.role] || person.role}</span></div>
              <div>
                {person.archived_at ? <span className="tp-badge">Archived <LocalDate value={person.archived_at} /></span> : <span
                  className={`training-status training-status--${person.attentionStatus}`}
                  title={person.attentionStatus === "not-started" ? "No completed attempts" : "Based on the latest completed attempt"}
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
