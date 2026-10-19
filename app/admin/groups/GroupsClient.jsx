"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function GroupsClient({ initialGroups, initialMemberships, people, courses, initialAssignments, initialGroupId }) {
  const supabase = createClient();
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);
  const [memberships, setMemberships] = useState(initialMemberships);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [selectedId, setSelectedId] = useState(initialGroups.some((group) => group.id === initialGroupId) ? initialGroupId : initialGroups[0]?.id);
  const [newGroup, setNewGroup] = useState("");
  const [edit, setEdit] = useState(null);
  const [personToAdd, setPersonToAdd] = useState("");
  const [courseToAdd, setCourseToAdd] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const coursesById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const selected = groups.find((group) => group.id === selectedId);
  const members = memberships
    .filter((membership) => membership.group_id === selectedId)
    .map((membership) => peopleById.get(membership.user_id))
    .filter(Boolean)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const groupAssignments = assignments.filter((assignment) => assignment.group_id === selectedId && coursesById.has(assignment.course_id));
  const availablePeople = people.filter((person) => !members.some((member) => member.id === person.id));
  const availableCourses = courses.filter((course) => !groupAssignments.some((assignment) => assignment.course_id === course.id));

  async function run(action, success) {
    setBusy(true);
    setMessage({ type: "", text: "" });
    try {
      await action();
      if (success) setMessage({ type: "success", text: success });
      router.refresh();
    } catch (error) {
      const text = /duplicate key|unique/i.test(error.message || "") ? "A group with that name already exists." : error.message;
      setMessage({ type: "error", text: text || "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  function selectGroup(groupId) {
    setSelectedId(groupId);
    setEdit(null);
    setPersonToAdd("");
    setCourseToAdd("");
    setMessage({ type: "", text: "" });
  }

  function createGroup(event) {
    event.preventDefault();
    const name = newGroup.trim();
    if (!name) return;
    run(async () => {
      const { data, error } = await supabase.from("groups").insert({ name }).select("id, name, description, created_at").single();
      if (error) throw error;
      setGroups((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewGroup("");
      setSelectedId(data.id);
    }, `Created “${name}”. Add members and courses below.`);
  }

  function saveGroup(event) {
    event.preventDefault();
    if (!edit.name.trim()) return;
    run(async () => {
      const { data, error } = await supabase
        .from("groups")
        .update({ name: edit.name.trim(), description: edit.description.trim() || null })
        .eq("id", selectedId)
        .select("id, name, description, created_at")
        .single();
      if (error) throw error;
      setGroups((current) => current.map((group) => (group.id === data.id ? data : group)).sort((a, b) => a.name.localeCompare(b.name)));
      setEdit(null);
    }, "Group saved.");
  }

  function deleteGroup() {
    if (!window.confirm(`Delete “${selected.name}”? Its members stay in the portal, but courses assigned through this group will no longer be required for them.`)) return;
    run(async () => {
      const { error } = await supabase.from("groups").delete().eq("id", selectedId);
      if (error) throw error;
      const remaining = groups.filter((group) => group.id !== selectedId);
      setGroups(remaining);
      setMemberships((current) => current.filter((membership) => membership.group_id !== selectedId));
      setAssignments((current) => current.filter((assignment) => assignment.group_id !== selectedId));
      setSelectedId(remaining[0]?.id);
    }, "Group deleted.");
  }

  function addMember() {
    run(async () => {
      const { data, error } = await supabase
        .from("group_members")
        .insert({ group_id: selectedId, user_id: personToAdd })
        .select("group_id, user_id, added_at")
        .single();
      if (error) throw error;
      setMemberships((current) => [...current, data]);
      setPersonToAdd("");
    });
  }

  function removeMember(userId) {
    run(async () => {
      const { error } = await supabase.from("group_members").delete().eq("group_id", selectedId).eq("user_id", userId);
      if (error) throw error;
      setMemberships((current) => current.filter((membership) => !(membership.group_id === selectedId && membership.user_id === userId)));
    });
  }

  function assignCourse() {
    run(async () => {
      const { data, error } = await supabase
        .from("course_assignments")
        .insert({ course_id: courseToAdd, group_id: selectedId })
        .select("id, course_id, group_id")
        .single();
      if (error) throw error;
      setAssignments((current) => [...current, data]);
      setCourseToAdd("");
    });
  }

  function unassignCourse(assignmentId) {
    run(async () => {
      const { error } = await supabase.from("course_assignments").delete().eq("id", assignmentId);
      if (error) throw error;
      setAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId));
    });
  }

  return (
    <main className="tp-page tp-fade-in">
      <div className="page-heading">
        <div className="tp-label">Admin workspace</div>
        <h1 className="tp-display">Groups</h1>
        <p>Group people, such as Titan Distributors or a manager’s team, then assign courses to the whole group. A person can belong to several groups.</p>
      </div>

      {message.text && (
        <div className={message.type === "error" ? "notice notice--error" : "notice notice--success"} role={message.type === "error" ? "alert" : "status"}>{message.text}</div>
      )}

      <div className="groups-layout">
        <aside className="tp-card groups-list">
          <form className="groups-list__create" onSubmit={createGroup}>
            <input className="tp-input" aria-label="New group name" placeholder="New group name" value={newGroup} onChange={(event) => setNewGroup(event.target.value)} />
            <button className="tp-btn tp-btn-primary" type="submit" disabled={busy || !newGroup.trim()}>Add</button>
          </form>
          {groups.map((group) => {
            const memberCount = memberships.filter((membership) => membership.group_id === group.id).length;
            const courseCount = assignments.filter((assignment) => assignment.group_id === group.id && coursesById.has(assignment.course_id)).length;
            return (
              <button type="button" key={group.id} className={`groups-list__item ${group.id === selectedId ? "is-selected" : ""}`} onClick={() => selectGroup(group.id)}>
                <strong>{group.name}</strong>
                <small>{memberCount} {memberCount === 1 ? "member" : "members"} · {courseCount} {courseCount === 1 ? "course" : "courses"}</small>
              </button>
            );
          })}
          {groups.length === 0 && <div className="chip-list__empty" style={{ padding: 14 }}>No groups yet.</div>}
        </aside>

        {selected ? (
          <section className="tp-card tp-form-card group-detail">
            {edit ? (
              <form onSubmit={saveGroup} className="group-detail__edit">
                <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Name</div><input className="tp-input" value={edit.name} onChange={(event) => setEdit({ ...edit, name: event.target.value })} required /></label>
                <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Description</div><input className="tp-input" value={edit.description} onChange={(event) => setEdit({ ...edit, description: event.target.value })} /></label>
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
                  <Link className="tp-btn tp-btn-ghost" href={`/admin?group=${selected.id}`}>View compliance</Link>
                  <button type="button" className="tp-btn tp-btn-ghost" onClick={() => setEdit({ name: selected.name, description: selected.description || "" })}>Edit</button>
                  <button type="button" className="tp-btn tp-btn-danger" disabled={busy} onClick={deleteGroup}>Delete</button>
                </div>
              </div>
            )}

            <div className="course-admin__subhead">Members ({members.length})</div>
            <div className="chip-list">
              {members.map((member) => (
                <span className="chip" key={member.id}>
                  <Link href={`/profile/${member.id}`}>{member.full_name}</Link>
                  <button type="button" aria-label={`Remove ${member.full_name}`} disabled={busy} onClick={() => removeMember(member.id)}>×</button>
                </span>
              ))}
              {members.length === 0 && <span className="chip-list__empty">No members yet</span>}
            </div>
            <div className="inline-add">
              <select className="tp-input" aria-label="Person to add" value={personToAdd} onChange={(event) => setPersonToAdd(event.target.value)}>
                <option value="">Choose a person…</option>
                {availablePeople.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
              </select>
              <button type="button" className="tp-btn tp-btn-ghost" disabled={!personToAdd || busy} onClick={addMember}>Add member</button>
            </div>

            <div className="course-admin__subhead">Required courses ({groupAssignments.length})</div>
            <div className="chip-list">
              {groupAssignments.map((assignment) => {
                const course = coursesById.get(assignment.course_id);
                return (
                  <span className="chip" key={assignment.id}>
                    <Link href={`/admin/courses/${course.id}`}><span className="tp-mono">{course.code}</span> · {course.title}</Link>
                    <button type="button" aria-label={`Unassign ${course.title}`} disabled={busy} onClick={() => unassignCourse(assignment.id)}>×</button>
                  </span>
                );
              })}
              {groupAssignments.length === 0 && <span className="chip-list__empty">No courses assigned</span>}
            </div>
            <div className="inline-add">
              <select className="tp-input" aria-label="Course to assign" value={courseToAdd} onChange={(event) => setCourseToAdd(event.target.value)}>
                <option value="">Choose a course…</option>
                {availableCourses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
              </select>
              <button type="button" className="tp-btn tp-btn-ghost" disabled={!courseToAdd || busy} onClick={assignCourse}>Assign course</button>
            </div>
          </section>
        ) : (
          <section className="tp-card admin-insight-empty">Create a group to get started.</section>
        )}
      </div>
    </main>
  );
}
