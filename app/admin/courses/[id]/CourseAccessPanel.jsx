"use client";

import { useMemo, useState } from "react";
import { AddAsSelect, REQUIRED_HINT, RequiredSelect, requiredMessage } from "@/components/AssignmentControls";
import CourseAccessChoice from "@/components/CourseAccessChoice";
import MemberList from "@/components/MemberList";
import MultiPicker from "@/components/MultiPicker";
import { confirmAccessChange, courseAccess, courseAccessFields } from "@/lib/course-access";
import { byName } from "@/lib/people";
import { groupItems, personItems } from "@/lib/picker-items";

const NOUNS = { group_id: ["training group", "training groups"], user_id: ["person", "people"] };

function AccessNote({ access, count }) {
  if (access === "hidden") return <p className="access-note is-hidden">This course is a draft, so nobody below can see it yet. Choose one of the other options when it’s ready.</p>;
  if (access === "everyone") return <p className="access-note is-everyone">Every learner can already see this course. Add groups or people here only to make it required for them.</p>;
  if (count === 0) return <p className="access-note is-hidden">Not given to anyone yet, so only admins can see it.</p>;
  return null;
}

// Who can see the course, and which groups and people it's given to (required or optional).
export default function CourseAccessPanel({ course, assignments, groups, people, archived, busy, change, supabase }) {
  const access = courseAccess(course);
  const [addAs, setAddAs] = useState("required");
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

  function add(field, ids) {
    const [one, many] = NOUNS[field];
    const required = addAs === "required";
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

  return (
    <section className="tp-card tp-form-card">
      <div className="tp-label form-section-label--tight">Who can see this course</div>
      <CourseAccessChoice value={access} onChange={setAccess} disabled={locked} />

      <div className="course-admin__subhead access-heading">Given to</div>
      <AccessNote access={access} count={assignments.length} />
      <p className="course-admin__hint">{REQUIRED_HINT}</p>
      {!archived && <AddAsSelect value={addAs} onChange={setAddAs} />}

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
        <MultiPicker items={groupOptions} excludeIds={assignedGroups.map((assignment) => assignment.group_id)} onAdd={(ids) => add("group_id", ids)}
          placeholder="Add training groups…" addLabel="Add" noun="training group" busy={busy === "assign"} />
      )}

      <div className="course-admin__subhead">Individual people</div>
      {!archived && (
        <MultiPicker items={personOptions} excludeIds={assignedPeople.map((assignment) => assignment.user_id)} onAdd={(ids) => add("user_id", ids)}
          placeholder="Add people by name or email…" addLabel="Add" noun="person" busy={busy === "assign"} pasteEmails />
      )}
      <MemberList
        people={assignedPeopleList}
        onRemove={archived ? undefined : (person) => remove(assignmentByPerson.get(person.id))}
        actions={(person) => <RequiredSelect assignment={assignmentByPerson.get(person.id)} label={person.full_name || person.email} onChange={setRequired} disabled={locked} />}
        busy={locked}
        emptyText="No individual people"
      />
    </section>
  );
}
