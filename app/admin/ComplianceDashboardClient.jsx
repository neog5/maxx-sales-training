"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { COMPLIANCE_LABELS, complianceCsv } from "@/lib/compliance.mjs";
import { localDateStamp } from "@/lib/format.mjs";
import { ROLE_LABELS } from "@/lib/roles.mjs";
import WatchlistBar from "./WatchlistBar";

const STATUS_ORDER = { non_compliant: 0, compliant: 1, none: 2 };

function GroupCard({ summary, selected, onSelect }) {
  return (
    <button type="button" className={`tp-card group-summary__item ${selected ? "is-selected" : ""} ${summary.nonCompliantCount ? "has-gaps" : ""}`} onClick={onSelect}
      aria-pressed={selected} aria-label={`${summary.name}: ${summary.compliantCount} of ${summary.assessedCount} compliant`}>
      <span>{summary.name}</span>
      <strong className="tp-mono">{summary.compliantCount}<small>/{summary.assessedCount}</small></strong>
      <small>{summary.memberCount === 0 ? "no members" : summary.assessedCount === 0 ? "nothing assigned" : "compliant"}</small>
    </button>
  );
}

export default function ComplianceDashboardClient({ rows, groupSummaries, watchlists = [], courseLabels, showCentralGroups = false, initialGroup = "all", initialStatus = "all" }) {
  const viewSummaries = groupSummaries.filter((summary) => summary.kind === "view");
  const centralSummaries = groupSummaries.filter((summary) => summary.kind !== "view");
  const viewSummaryById = new Map(viewSummaries.map((summary) => [summary.id, summary]));
  const trainingGroupNames = new Map(centralSummaries.map((summary) => [summary.id, summary.name]));
  const trainingGroupsOf = (row) => row.groupIds.map((id) => trainingGroupNames.get(id)).filter(Boolean).sort();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(initialGroup);
  const [status, setStatus] = useState(initialStatus);

  const inGroup = useMemo(() => (group === "all" ? rows : rows.filter((row) => row.groupIds.includes(group))), [rows, group]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return inGroup
      .filter((row) => (status === "all" || row.status === status)
        && (!normalizedQuery || `${row.full_name || ""} ${row.email || ""}`.toLocaleLowerCase().includes(normalizedQuery)))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.full_name.localeCompare(b.full_name));
  }, [inGroup, query, status]);

  const counts = {
    compliant: inGroup.filter((row) => row.status === "compliant").length,
    non_compliant: inGroup.filter((row) => row.status === "non_compliant").length,
    none: inGroup.filter((row) => row.status === "none").length,
  };

  function exportCsv() {
    const blob = new Blob([complianceCsv(filtered.map((row) => ({ ...row, groupNames: trainingGroupsOf(row) })), ROLE_LABELS, { includeGroups: showCentralGroups })], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const groupName = groupSummaries.find((summary) => summary.id === group)?.name;
    link.href = url;
    link.download = `compliance-${(groupName || "everyone").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${localDateStamp()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="tp-page tp-fade-in">
      <div className="page-heading section-heading-row">
        <div>
          <div className="tp-label">Training compliance</div>
          <h1 className="tp-display">Dashboard</h1>
          <p>Everyone’s required courses, completed versus assigned. A person is compliant once they’ve passed every course assigned to them or their training groups.</p>
        </div>
        <button type="button" className="tp-btn tp-btn-ghost" onClick={exportCsv} disabled={filtered.length === 0}>Export CSV</button>
      </div>

      <section className="group-summary" aria-label="Compliance by training group">
        <button type="button" className={`tp-card group-summary__item ${group === "all" ? "is-selected" : ""}`} onClick={() => setGroup("all")}
          aria-pressed={group === "all"} aria-label={`Everyone: ${rows.filter((row) => row.status === "compliant").length} of ${rows.filter((row) => row.status !== "none").length} compliant`}>
          <span>Everyone</span>
          <strong className="tp-mono">{rows.filter((row) => row.status === "compliant").length}<small>/{rows.filter((row) => row.status !== "none").length}</small></strong>
          <small>compliant</small>
        </button>
        {showCentralGroups && centralSummaries.map((summary) => <GroupCard key={summary.id} summary={summary} selected={group === summary.id} onSelect={() => setGroup(summary.id)} />)}
      </section>

      <WatchlistBar watchlists={watchlists} summaries={viewSummaryById} people={rows} selectedId={group} onSelect={setGroup} />

      <section className="tp-card directory-toolbar compliance-toolbar" aria-label="Dashboard filters">
        <label className="directory-search">
          <span className="tp-sr-only">Search people</span>
          <span className="directory-search__icon" aria-hidden="true">⌕</span>
          <input className="tp-input" type="search" placeholder="Search by name or email…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>
          <span className="tp-sr-only">Filter by group</span>
          <select className="tp-input" value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="all">Everyone</option>
            {viewSummaries.length > 0 && <optgroup label="My watchlists">{viewSummaries.map((summary) => <option key={summary.id} value={summary.id}>{summary.name}</option>)}</optgroup>}
            {showCentralGroups && centralSummaries.length > 0 && <optgroup label="Training groups">{centralSummaries.map((summary) => <option key={summary.id} value={summary.id}>{summary.name}</option>)}</optgroup>}
          </select>
        </label>
        <div className="status-filter" role="group" aria-label="Filter by compliance">
          {[["all", `All ${inGroup.length}`], ["non_compliant", `Not compliant ${counts.non_compliant}`], ["compliant", `Compliant ${counts.compliant}`], ["none", `Nothing assigned ${counts.none}`]].map(([value, label]) => (
            <button type="button" key={value} className={status === value ? "is-selected" : ""} aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>
          ))}
        </div>
      </section>

      <div className="directory-result-count" role="status">Showing {filtered.length} of {inGroup.length} people</div>

      <section className="tp-card compliance-table">
        <div className={`compliance-table__head ${showCentralGroups ? "" : "is-compact"}`}>
          <div>Person</div>{showCentralGroups && <div>Training groups</div>}<div>Completed</div><div>Status</div>
        </div>
        <div className="tp-scroll compliance-table__body">
          {filtered.map((row) => (
            <article className={`compliance-table__row ${showCentralGroups ? "" : "is-compact"}`} key={row.id}>
              <div className="people-identity">
                <span className="people-avatar" aria-hidden="true">{row.full_name?.trim()?.charAt(0)?.toUpperCase() || "U"}</span>
                <span>
                  <Link className="profile-link" href={`/profile/${row.id}`}>{row.full_name}</Link>
                  <small>{ROLE_LABELS[row.role] || row.role}</small>
                </span>
              </div>
              {showCentralGroups && <div className="compliance-groups">{trainingGroupsOf(row).join(", ") || <span className="chip-list__empty">None</span>}</div>}
              <div className="compliance-progress" title={row.outstandingCourseIds.length ? `Outstanding: ${row.outstandingCourseIds.map((id) => courseLabels[id]).join("; ")}` : undefined}>
                <span className="tp-mono">{row.completedCount}/{row.assignedCount}</span>
                <span className="compliance-progress__track"><span style={{ width: `${row.assignedCount ? Math.round((row.completedCount / row.assignedCount) * 100) : 0}%` }} /></span>
              </div>
              <div>
                <span className={`training-status training-status--${row.status}`}><span aria-hidden="true"></span>{COMPLIANCE_LABELS[row.status]}</span>
                {row.outstandingCourseIds.length > 0 && (
                  <small className="compliance-outstanding">{row.outstandingCourseIds.length} outstanding: {row.outstandingCourseIds.map((id) => courseLabels[id]?.split(" · ")[0]).join(", ")}</small>
                )}
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="directory-empty">
              <strong>No people match these filters.</strong>
              <span>Try another group or status.</span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
