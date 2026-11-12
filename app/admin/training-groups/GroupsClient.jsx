"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import MemberList from "@/components/MemberList";
import MultiPicker from "@/components/MultiPicker";
import { byName } from "@/lib/people";
import { courseItems, personItems } from "@/lib/picker-items";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";
import useAdminMutation from "../useAdminMutation";

const GROUP_COLUMNS = "id, name, description, created_at";
const DUPLICATE_NAME = "A training group with that name already exists.";

function byGroupName(a, b) {
  return a.name.localeCompare(b.name);
}

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

// Training groups decide who must complete which courses. Admins manage their members
// and the courses assigned to each group here. The page loads everything once; changes
// update this local copy, so nothing else needs re-rendering.
export default function GroupsClient({ initialGroups, initialMemberships, people, courses = [], initialAssignments = [], initialGroupId }) {
  const supabase = createClient();
  const { run, busy: busyLabel, clear, notices } = useAdminMutation();
  const busy = Boolean(busyLabel);
  const [groups, setGroups] = useState(initialGroups);
  const [memberships, setMemberships] = useState(initialMemberships);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [selectedId, setSelectedId] = useState(initialGroups.some((group) => group.id === initialGroupId) ? initialGroupId : initialGroups[0]?.id);
  const [newGroup, setNewGroup] = useState("");
  const [edit, setEdit] = useState(null);

  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const coursesById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const personOptions = useMemo(() => personItems(people), [people]);
  const courseOptions = useMemo(() => courseItems(courses), [courses]);
  const selected = groups.find((group) => group.id === selectedId);
  const memberIdsOf = (groupId) => memberships.filter((membership) => membership.group_id === groupId).map((membership) => membership.user_id);
  const assignmentsOf = (groupId) => assignments.filter((assignment) => assignment.group_id === groupId && coursesById.has(assignment.course_id));
  const memberIds = memberIdsOf(selectedId);
  const members = memberIds.map((id) => peopleById.get(id)).filter(Boolean).sort(byName);
  const groupAssignments = assignmentsOf(selectedId);

  function selectGroup(groupId) {
    setSelectedId(groupId);
    setEdit(null);
    clear();
  }

  async function createGroup(event) {
    event.preventDefault();
    const name = newGroup.trim();
    if (!name) return;
    const created = await run("create", () => supabase.from("groups").insert({ name }).select(GROUP_COLUMNS).single(),
      { success: `Created “${name}”. Add people below.`, duplicate: DUPLICATE_NAME });
    if (!created) return;
    setGroups((current) => [...current, created].sort(byGroupName));
    setNewGroup("");
    setSelectedId(created.id);
  }

  async function saveGroup(event) {
    event.preventDefault();
    if (!edit.name.trim()) return;
    const changes = { name: edit.name.trim(), description: edit.description.trim() || null };
    const saved = await run("save", () => supabase.from("groups").update(changes).eq("id", selectedId).select(GROUP_COLUMNS).single(),
      { success: "Saved.", duplicate: DUPLICATE_NAME });
    if (!saved) return;
    setGroups((current) => current.map((group) => (group.id === saved.id ? saved : group)).sort(byGroupName));
    setEdit(null);
  }

  async function deleteGroup() {
    const warning = `Delete the training group “${selected.name}”? Its members stay in the portal, but courses assigned through this group will no longer be required for them.`;
    if (!window.confirm(warning)) return;
    const deletedId = selectedId;
    if (!await run("delete", () => supabase.from("groups").delete().eq("id", deletedId), { success: "Deleted." })) return;
    const remaining = groups.filter((group) => group.id !== deletedId);
    setGroups(remaining);
    setMemberships((current) => current.filter((membership) => membership.group_id !== deletedId));
    setAssignments((current) => current.filter((assignment) => assignment.group_id !== deletedId));
    setSelectedId(remaining[0]?.id);
  }

  async function addMembers(userIds) {
    const rows = userIds.map((userId) => ({ group_id: selectedId, user_id: userId }));
    const added = await run("members", () => supabase.from("group_members").insert(rows),
      { success: `Added ${plural(userIds.length, "person", "people")}.` });
    if (added) setMemberships((current) => [...current, ...rows]);
    return added;
  }

  async function removeMember(person) {
    const groupId = selectedId;
    if (!await run("members", () => supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", person.id))) return;
    setMemberships((current) => current.filter((membership) => !(membership.group_id === groupId && membership.user_id === person.id)));
  }

  async function assignCourses(courseIds) {
    const created = await run("courses", () => supabase
      .from("course_assignments")
      .insert(courseIds.map((courseId) => ({ course_id: courseId, group_id: selectedId })))
      .select("id, course_id, group_id"));
    if (created) setAssignments((current) => [...current, ...created]);
    return created;
  }

  async function unassignCourse(assignmentId) {
    if (!await run("courses", () => supabase.from("course_assignments").delete().eq("id", assignmentId))) return;
    setAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId));
  }

  return (
    <main className="tp-page tp-fade-in">
      <div className="page-heading">
        <h1 className="tp-display">Training groups</h1>
        <p>Training groups decide what people must complete. Put people in a group, such as Titan Distributors or a region, then assign courses to the whole group. A person can belong to several training groups.</p>
      </div>

      {notices}

      <div className="groups-layout">
        <aside className="tp-card groups-list">
          <form className="groups-list__create" onSubmit={createGroup}>
            <input className="tp-input" aria-label="New training group name" placeholder="New training group" value={newGroup} onChange={(event) => setNewGroup(event.target.value)} />
            <button className="tp-btn tp-btn-primary" type="submit" disabled={busy || !newGroup.trim()}>Add</button>
          </form>
          {groups.map((group) => (
            <button type="button" key={group.id} className={`groups-list__item ${group.id === selectedId ? "is-selected" : ""}`} onClick={() => selectGroup(group.id)}>
              <strong>{group.name}</strong>
              <small>{plural(memberIdsOf(group.id).length, "member", "members")} · {plural(assignmentsOf(group.id).length, "course", "courses")}</small>
            </button>
          ))}
          {groups.length === 0 && <div className="chip-list__empty groups-list__empty">No training groups yet.</div>}
        </aside>

        {selected ? (
          <section className="tp-card tp-form-card group-detail">
            {edit ? (
              <form onSubmit={saveGroup} className="group-detail__edit">
                <label className="tp-form-field"><div className="tp-label form-label">Name</div><input className="tp-input" value={edit.name} onChange={(event) => setEdit({ ...edit, name: event.target.value })} required /></label>
                <label className="tp-form-field"><div className="tp-label form-label">Description</div><input className="tp-input" value={edit.description} onChange={(event) => setEdit({ ...edit, description: event.target.value })} /></label>
                <div className="tp-form-actions">
                  <button className="tp-btn tp-btn-primary" type="submit" disabled={busy}>Save</button>
                  <button className="tp-btn tp-btn-ghost" type="button" onClick={() => setEdit(null)}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className="group-detail__header">
                <div>
                  <h2 className="tp-display">{selected.name}</h2>
                  {selected.description && <p>{selected.description}</p>}
                </div>
                <div className="group-detail__actions">
                  <Link className="tp-btn tp-btn-ghost" href={`${routes.admin}?${new URLSearchParams({ group: selected.id })}`}>View compliance</Link>
                  <button type="button" className="tp-btn tp-btn-ghost" onClick={() => setEdit({ name: selected.name, description: selected.description || "" })}>Edit</button>
                  <button type="button" className="tp-btn tp-btn-danger" disabled={busy} onClick={deleteGroup}>Delete</button>
                </div>
              </div>
            )}

            <div className="course-admin__subhead">Members ({members.length})</div>
            <MultiPicker items={personOptions} excludeIds={memberIds} onAdd={addMembers} placeholder="Add people by name or email…" noun="person" busy={busy} pasteEmails />
            <MemberList people={members} onRemove={removeMember} busy={busy} emptyText="No members yet" />

            <div className="course-admin__subhead">Required courses ({groupAssignments.length})</div>
            <div className="chip-list">
              {groupAssignments.map((assignment) => {
                const course = coursesById.get(assignment.course_id);
                return (
                  <span className="chip" key={assignment.id}>
                    <Link href={routes.adminCourse(course.id)}><span className="tp-mono">{course.code}</span> · {course.title}</Link>
                    <button type="button" aria-label={`Unassign ${course.title}`} disabled={busy} onClick={() => unassignCourse(assignment.id)}>×</button>
                  </span>
                );
              })}
              {groupAssignments.length === 0 && <span className="chip-list__empty">No courses assigned</span>}
            </div>
            <MultiPicker items={courseOptions} excludeIds={groupAssignments.map((assignment) => assignment.course_id)} onAdd={assignCourses} placeholder="Assign courses by title or code…" addLabel="Assign" noun="course" busy={busy} />
          </section>
        ) : (
          <section className="tp-card admin-insight-empty">Create a training group to get started.</section>
        )}
      </div>
    </main>
  );
}
