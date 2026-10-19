"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const PAGE_SIZE = 25;

// Searchable, paged list of people for groups that can hold hundreds of members.
export default function MemberList({ people, onRemove, busy = false, emptyText = "No one yet", linkProfiles = true }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return people.filter((person) => {
      const haystack = `${person.full_name || ""} ${person.email || ""}`.toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [people, query]);

  if (people.length === 0) return <div className="chip-list__empty member-list__empty">{emptyText}</div>;

  return (
    <div className="member-list">
      {people.length > 8 && (
        <input className="tp-input member-list__search" type="search" placeholder={`Search ${people.length} people…`} aria-label="Search members"
          value={query} onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE); }} />
      )}
      <div className="member-list__rows">
        {filtered.slice(0, limit).map((person) => (
          <div className="member-list__row" key={person.id}>
            <span>
              {linkProfiles ? <Link className="profile-link" href={`/profile/${person.id}`}>{person.full_name}</Link> : <strong>{person.full_name}</strong>}
              {person.email && <small>{person.email}</small>}
            </span>
            {onRemove && <button type="button" className="tp-btn tp-btn-ghost member-list__remove" aria-label={`Remove ${person.full_name}`} disabled={busy} onClick={() => onRemove(person)}>Remove</button>}
          </div>
        ))}
        {filtered.length === 0 && <div className="chip-list__empty member-list__empty">No members match.</div>}
      </div>
      {filtered.length > limit && (
        <button type="button" className="picker__link member-list__more" onClick={() => setLimit((current) => current + PAGE_SIZE * 2)}>
          Show more ({filtered.length - limit} remaining)
        </button>
      )}
    </div>
  );
}
