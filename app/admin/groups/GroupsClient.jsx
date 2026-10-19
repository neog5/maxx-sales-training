"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MemberList from "@/components/MemberList";
import MultiPicker from "@/components/MultiPicker";
import { createClient } from "@/lib/supabase/client";
import { courseItems, personItems } from "@/lib/picker-items.mjs";

// Central groups (admin-managed; drive course assignments) and private view groups
// (each manager's or admin's own watch lists) share this editor.
const KINDS = {
  central: {
    groups: "groups",
    members: "group_members",
    key: "group_id",
    columns: "id, name, description, created_at",
    title: "Groups",
    intro: "Group people, such as Titan Distributors or a region, then assign courses to the whole group. A person can belong to several groups.",
    path: "/admin/groups",
  },
  view: {
    groups: "view_groups",
    members: "view_group_members",
    key: "view_group_id",
    columns: "id, name, created_at",
    title: "My view groups",
    intro: "Private lists of people whose compliance you want to watch, such as your team. Only you can see your view groups, and they don’t change what anyone has to complete.",
    path: "/admin/view-groups",
  },
};

export default function GroupsClient({ kind = "central", initialGroups, initialMemberships, people, courses = [], initialAssignments = [], initialGroupId }) {
  const config = KINDS[kind];
  const supabase = createClient();
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);
  const [memberships, setMemberships] = useState(initialMemberships);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [selectedId, setSelectedId] = useState(initialGroups.some((group) => group.id === initialGroupId) ? initialGroupId : initialGroups[0]?.id);
  const [newGroup, setNewGroup] = useState("");
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const coursesById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const personOptions = useMemo(() => personItems(people), [people]);
  const courseOptions = useMemo(() => courseItems(courses), [courses]);
  const selected = groups.find((group) => group.id === selectedId);
  const memberIds = memberships.filter((membership) => membership.group_id === selectedId).map((membership) => membership.user_id);
  const members = memberIds.map((id) => peopleById.get(id)).filter(Boolean).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  const groupAssignments = assignments.filter((assignment) => assignment.group_id === selectedId && coursesById.has(assignment.course_id));

  async function run(action, success) {
    setBusy(true);
    setMessage({ type: "", text: "" });
    try {
      await action();
      if (success) setMessage({ type: "success", text: success });
      router.refresh();
      return true;
    } catch (error) {
      const text = /duplicate key|unique/i.test(error.message || "") ? "A group with that name already exists." : error.message;
      setMessage({ type: "error", text: text || "Something went wrong. Please try again." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function selectGroup(groupId) {
    setSelectedId(groupId);
    setEdit(null);
    setMessage({ type: "", text: "" });
  }

  function createGroup(event) {
    event.preventDefault();
    const name = newGroup.trim();
    if (!name) return;
    run(async () => {
      const { data, error } = await supabase.from(config.groups).insert({ name }).select(config.columns).single();
      if (error) throw error;
      setGroups((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewGroup("");
      setSelectedId(data.id);
    }, `Created “${name}”. Add people below.`);
  }

  function saveGroup(event) {
    event.preventDefault();
    if (!edit.name.trim()) return;
    const changes = kind === "central" ? { name: edit.name.trim(), description: edit.description.trim() || null } : { name: edit.name.trim() };
    run(async () => {
      const { data, error } = await supabase.from(config.groups).update(changes).eq("id", selectedId).select(config.columns).single();
      if (error) throw error;
      setGroups((current) => current.map((group) => (group.id === data.id ? data : group)).sort((a, b) => a.name.localeCompare(b.name)));
      setEdit(null);
    }, "Group saved.");
  }

  function deleteGroup() {
    const warning = kind === "central"
      ? `Delete “${selected.name}”? Its members stay in the portal, but courses assigned through this group will no longer be required for them.`
      : `Delete your view group “${selected.name}”? Nobody’s training is affected.`;
    if (!window.confirm(warning)) return;
    run(async () => {
      const { error } = await supabase.from(config.groups).delete().eq("id", selectedId);
      if (error) throw error;
      const remaining = groups.filter((group) => group.id !== selectedId);
      setGroups(remaining);
      setMemberships((current) => current.filter((membership) => membership.group_id !== selectedId));
      setAssignments((current) => current.filter((assignment) => assignment.group_id !== selectedId));
      setSelectedId(remaining[0]?.id);
    }, "Group deleted.");
  }

  function addMembers(userIds) {
    return run(async () => {
      const { error } = await supabase.from(config.members).insert(userIds.map((userId) => ({ [config.key]: selectedId, user_id: userId })));
      if (error) throw error;
      setMemberships((current) => [...current, ...userIds.map((userId) => ({ group_id: selectedId, user_id: userId }))]);
    }, `Added ${userIds.length} ${userIds.length === 1 ? "person" : "people"}.`);
  }

  function removeMember(person) {
    run(async () => {
      const { error } = await supabase.from(config.members).delete().eq(config.key, selectedId).eq("user_id", person.id);
      if (error) throw error;
      setMemberships((current) => current.filter((membership) => !(membership.group_id === selectedId && membership.user_id === person.id)));
    });
  }

  function assignCourses(courseIds) {
    return run(async () => {
      const { data, error } = await supabase
        .from("course_assignments")
        .insert(courseIds.map((courseId) => ({ course_id: courseId, group_id: selectedId })))
        .select("id, course_id, group_id");
      if (error) throw error;
      setAssignments((current) => [...current, ...data]);
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
        <div className="tp-label">{kind === "central" ? "Admin workspace" : "Your workspace"}</div>
        <h1 className="tp-display">{config.title}</h1>
        <p>{config.intro}</p>
      </div>

      {message.text && (
        <div className={message.type === "error" ? "notice notice--error" : "notice notice--success"} role={message.type === "error" ? "alert" : "status"}>{message.text}</div>
      )}

      <div className="groups-layout">
        <aside className="tp-card groups-list">
          <form className="groups-list__create" onSubmit={createGroup}>
            <input className="tp-input" aria-label="New group name" placeholder={kind === "central" ? "New group name" : "e.g. My team"} value={newGroup} onChange={(event) => setNewGroup(event.target.value)} />
            <button className="tp-btn tp-btn-primary" type="submit" disabled={busy || !newGroup.trim()}>Add</button>
          </form>
          {groups.map((group) => {
            const memberCount = memberships.filter((membership) => membership.group_id === group.id).length;
            const courseCount = assignments.filter((assignment) => assignment.group_id === group.id && coursesById.has(assignment.course_id)).length;
            return (
              <button type="button" key={group.id} className={`groups-list__item ${group.id === selectedId ? "is-selected" : ""}`} onClick={() => selectGroup(group.id)}>
                <strong>{group.name}</strong>
                <small>{memberCount} {memberCount === 1 ? "member" : "members"}{kind === "central" ? ` · ${courseCount} ${courseCount === 1 ? "course" : "courses"}` : ""}</small>
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
                {kind === "central" && <label className="tp-form-field"><div className="tp-label" style={{ marginBottom: 6 }}>Description</div><input className="tp-input" value={edit.description} onChange={(event) => setEdit({ ...edit, description: event.target.value })} /></label>}
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
            <MultiPicker items={personOptions} excludeIds={memberIds} onAdd={addMembers} placeholder="Add people by name or email…" noun="person" busy={busy} pasteEmails />
            <MemberList people={members} onRemove={removeMember} busy={busy} emptyText="No members yet" />

            {kind === "central" && (
              <>
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
                <MultiPicker items={courseOptions} excludeIds={groupAssignments.map((assignment) => assignment.course_id)} onAdd={assignCourses} placeholder="Assign courses by title or code…" addLabel="Assign" noun="course" busy={busy} />
              </>
            )}
          </section>
        ) : (
          <section className="tp-card admin-insight-empty">Create a group to get started.</section>
        )}
      </div>
    </main>
  );
}
