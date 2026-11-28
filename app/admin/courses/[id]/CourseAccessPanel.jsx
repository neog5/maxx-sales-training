"use client";

import { useMemo } from "react";
import { REQUIRED_HINT, RequiredSelect, requiredMessage } from "@/components/AssignmentControls";
import CourseAccessChoice from "@/components/CourseAccessChoice";
import MemberList from "@/components/MemberList";
import MultiPicker from "@/components/MultiPicker";
import { confirmAccessChange, courseAccess, courseAccessFields } from "@/lib/course-access";
import { byName } from "@/lib/people";
import { groupItems, personItems } from "@/lib/picker-items";

const NOUNS = { group_id: ["training group", "training groups"], user_id: ["person", "people"] };

// Who can see the course, and which groups and people it's given to (required or optional).
// A course open to everyone is required or optional for everyone (migration 019), so the
// groups-and-people list is folded away while that's chosen: it only matters again if the
// course goes back to "only the groups and people you give it to".
export default function CourseAccessPanel({ course, assignments, groups, people, archived, busy, change, supabase }) {
  const access = courseAccess(course);
  const groupNames = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);
  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const personOptions = useMemo(() => personItems(people), [people]);
  const groupOptions = useMemo(() => groupItems(groups), [groups]);
  const assignedGroups = assignments.filter((assignment) => assignment.group_id);
  const assignedPeople = assignments.filter((assignment) => assignment.user_id);
  const assignmentByPerson = new Map(assignedPeople.map((assignment) => [assignment.user_id, assignment]));
  const assignedPeopleList = assignedPeople.map((assignment) => peopleById.get(assignment.user_id)).filter(Boolean).sort(byName);
  const locked = archived || Boolean(busy);

  function setAccess(next) {
    if (next === access || !confirmAccessChange(access, next)) return;
    change("access", () => supabase.from("courses").update(courseAccessFields(next)).eq("id", course.id), { success: "Saved who can see this course." });
  }

  function setEveryoneRequired(required) {
    change("access", () => supabase.from("courses").update(courseAccessFields("everyone", required)).eq("id", course.id),
      { success: required ? "Now required for everyone." : "Now optional for everyone." });
  }

  function add(field, ids, required) {
    const [one, many] = NOUNS[field];
    return change("assign", () => supabase.from("course_assignments").insert(ids.map((id) => ({ course_id: course.id, [field]: id, required }))),
      { success: `Given to ${ids.length} ${ids.length === 1 ? one : many} as ${required ? "required" : "optional"}.` });
  }

  function setRequired(assignment, required) {
    return change("assign", () => supabase.from("course_assignments").update({ required }).eq("id", assignment.id),
      { success: requiredMessage(required) });
  }

  function remove(assignment) {
    return change("assign", () => supabase.from("course_assignments").delete().eq("id", assignment.id));
  }

  const givenTo = (
    <>
      <p className="course-admin__hint">{REQUIRED_HINT}</p>

      <div className="course-admin__subhead">Training groups</div>
      {assignedGroups.length > 0 ? (
        <div className="member-list__rows access-rows">
          {assignedGroups.map((assignment) => {
            const name = groupNames.get(assignment.group_id) || "Training group";
            return (
              <div className="member-list__row" key={assignment.id}>
                <span>{name}</span>
                <span className="access-row__actions">
                  <RequiredSelect assignment={assignment} label={name} onChange={setRequired} disabled={locked} />
                  {!archived && <button type="button" className="tp-btn tp-btn-ghost member-list__remove" aria-label={`Remove ${name}`} disabled={locked} onClick={() => remove(assignment)}>Remove</button>}
                </span>
              </div>
            );
          })}
        </div>
      ) : <div className="chip-list__empty member-list__empty">No training groups</div>}
      {!archived && (
        <MultiPicker items={groupOptions} excludeIds={assignedGroups.map((assignment) => assignment.group_id)} onAdd={(ids, required) => add("group_id", ids, required)}
          placeholder="Find training groups…" noun="training group" busy={busy === "assign"} chooseRequired />
      )}

      <div className="course-admin__subhead">Individual people</div>
      {!archived && (
        <MultiPicker items={personOptions} excludeIds={assignedPeople.map((assignment) => assignment.user_id)} onAdd={(ids, required) => add("user_id", ids, required)}
          placeholder="Find people by name or email…" noun="person" busy={busy === "assign"} pasteEmails chooseRequired />
      )}
      <MemberList
        people={assignedPeopleList}
        onRemove={archived ? undefined : (person) => remove(assignmentByPerson.get(person.id))}
        actions={(person) => <RequiredSelect assignment={assignmentByPerson.get(person.id)} label={person.full_name || person.email} onChange={setRequired} disabled={locked} />}
        busy={locked}
        emptyText="No individual people"
      />
    </>
  );

  return (
    <section className="tp-card tp-form-card">
      <div className="tp-label form-section-label--tight">Who can see this course</div>
      <CourseAccessChoice value={access} onChange={setAccess} disabled={locked} />

      {access === "everyone" ? (
        <>
          <div className="course-admin__subhead access-heading">For everyone, this course is</div>
          <div className="access-everyone" role="radiogroup" aria-label="Required or optional for everyone">
            {[[true, "Required", "Everyone must complete it."], [false, "Optional", "Everyone can take it."]].map(([value, label, hint]) => (
              <label key={label} className={`access-everyone__option${Boolean(course.everyone_required) === value ? " is-selected" : ""}`}>
                <input type="radio" name="everyone-required" checked={Boolean(course.everyone_required) === value} disabled={locked} onChange={() => setEveryoneRequired(value)} />
                <span><strong>{label}</strong><small>{hint}</small></span>
              </label>
            ))}
          </div>
          {assignments.length > 0 && (
            <details className="access-earlier">
              <summary>Also given to {assignments.length} {assignments.length === 1 ? "group or person" : "groups and people"}</summary>
              <p className="course-admin__hint">Anyone marked Required here still has to complete it.</p>
              {givenTo}
            </details>
          )}
        </>
      ) : (
        <>
          <div className="course-admin__subhead access-heading">Given to</div>
          {access === "hidden" && <p className="access-note is-hidden">Draft: nobody below can see it yet.</p>}
          {access === "assigned" && assignments.length === 0 && <p className="access-note is-hidden">Not given to anyone yet.</p>}
          {givenTo}
        </>
      )}
    </section>
  );
}
