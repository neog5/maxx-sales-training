import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import LocalDate from "@/components/LocalDate";
import QuestionPerformance from "@/components/QuestionPerformance";
import TopNav from "@/components/TopNav";
import { calculateQuestionPerformance } from "@/lib/assessment.mjs";
import { isRequirableCourse } from "@/lib/compliance.mjs";
import { ROLE_LABELS, assignableRoles, canViewReports, isAdmin } from "@/lib/roles.mjs";
import { createClient } from "@/lib/supabase/server";
import RoleEditor from "./RoleEditor";
import { fetchAssignmentsForUser } from "@/lib/assignments";
import RequiredTraining from "./RequiredTraining";

export default async function ProfilePage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viewer } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!viewer) redirect("/login");
  if (!canViewReports(viewer?.role) && user.id !== id) redirect(`/profile/${user.id}`);

  const [{ data: person }, { data: attempts }, { data: memberships }, { data: groups }, { data: courses }, { data: certificates }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role").eq("id", id).single(),
    supabase
      .from("quiz_attempts")
      .select("id, course_id, score, passed, submitted_at, status, courses(title, code)")
      .eq("user_id", id)
      .eq("status", "completed")
      .order("submitted_at", { ascending: false }),
    supabase.from("group_members").select("group_id").eq("user_id", id),
    supabase.from("groups").select("id, name").order("name"),
    supabase.from("courses").select("id, code, title, is_active, archived_at").order("code"),
    supabase.from("certificates").select("id, course_title, course_code, issued_at, expires_at").eq("user_id", id).order("issued_at", { ascending: false }),
  ]);
  if (!person) notFound();

  const groupIds = (memberships || []).map((membership) => membership.group_id);
  const [assignments, { data: requiredRows }] = await Promise.all([
    fetchAssignmentsForUser(supabase, id, groupIds),
    supabase.rpc("required_courses").eq("user_id", id),
  ]);
  const passedCourseIds = new Set((attempts || []).filter((attempt) => attempt.passed).map((attempt) => attempt.course_id));
  const requirableCourses = (courses || []).filter(isRequirableCourse);

  const attemptIds = (attempts || []).map((attempt) => attempt.id);
  let attemptQuestions = [];
  if (attemptIds.length) {
    const { data } = await supabase
      .from("attempt_questions")
      .select("attempt_id, is_mandatory, image_url, is_correct")
      .in("attempt_id", attemptIds);
    attemptQuestions = data || [];
  }

  const completedAttempts = attempts || [];
  const passedAttempts = completedAttempts.filter((attempt) => attempt.passed).length;
  const averageScore = completedAttempts.length
    ? Math.round(completedAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / completedAttempts.length)
    : null;
  const passRate = completedAttempts.length ? Math.round((passedAttempts / completedAttempts.length) * 100) : null;
  const questionPerformance = calculateQuestionPerformance(attemptQuestions);
  const questionsByAttempt = new Map();
  for (const question of attemptQuestions) {
    const summary = questionsByAttempt.get(question.attempt_id) || { total: 0, mandatory: 0, mandatoryCorrect: 0 };
    summary.total += 1;
    if (question.is_mandatory) {
      summary.mandatory += 1;
      summary.mandatoryCorrect += question.is_correct ? 1 : 0;
    }
    questionsByAttempt.set(question.attempt_id, summary);
  }

  return (
    <div>
      <TopNav profile={viewer} />
      <main className="tp-page tp-fade-in">
        {canViewReports(viewer.role) && <Link href="/admin/people" className="tp-btn tp-btn-ghost back-link">← Back to people</Link>}
        <div className="page-heading profile-heading">
          <div className="tp-label">User performance</div>
          <h1 className="tp-display">{person.full_name}</h1>
          <p>Review overall outcomes, accuracy by question type, and every completed assessment attempt.</p>
        </div>

        <section className="tp-card profile-summary">
          <div className="profile-summary__identity">
            <div className="profile-summary__avatar" aria-hidden="true">{person.full_name?.trim()?.charAt(0)?.toUpperCase() || "U"}</div>
            <div>
              <h2 className="profile-summary__name tp-display">{person.full_name}</h2>
              <div className="profile-summary__role">{ROLE_LABELS[person.role] || person.role}</div>
            </div>
          </div>
          {assignableRoles(viewer.role, person.role).length > 0 && person.id !== viewer.id && (
            <RoleEditor profileId={person.id} initialRole={person.role} roles={assignableRoles(viewer.role, person.role)} />
          )}
        </section>

        <RequiredTraining
          personId={person.id}
          canEdit={isAdmin(viewer.role)}
          showGroups={isAdmin(viewer.role) || viewer.id === person.id}
          requiredCourseIds={(requiredRows || []).map((row) => row.course_id)}
          groups={groups || []}
          initialGroupIds={groupIds}
          courses={requirableCourses}
          initialAssignments={assignments}
          passedCourseIds={[...passedCourseIds]}
        />

        <section className="profile-report-section">
          <div className="section-heading-row">
            <div>
              <div className="tp-label">Certificates</div>
              <span>Issued automatically the first time a course is passed</span>
            </div>
          </div>
          <div className="tp-card certificate-list">
            {(certificates || []).map((certificate) => (
              <div key={certificate.id} className="certificate-list__row">
                <div>
                  <strong>{certificate.course_title}</strong>
                  <small>{certificate.course_code} · completed <LocalDate value={certificate.issued_at} />{certificate.expires_at && <> · valid until <LocalDate value={certificate.expires_at} /></>}</small>
                </div>
                <Link href={`/certificates/${certificate.id}`} className="tp-btn tp-btn-ghost attempt-review-link">View</Link>
              </div>
            ))}
            {!certificates?.length && <div className="admin-insight-empty">No certificates yet.</div>}
          </div>
        </section>

        <div className="metric-grid metric-grid--profile">
          <div className="tp-card metric-card">
            <div className="tp-label">Completed attempts</div>
            <div className="tp-mono metric-value">{completedAttempts.length}</div>
          </div>
          <div className="tp-card metric-card">
            <div className="tp-label">Average score</div>
            <div className="tp-mono metric-value">{averageScore === null ? "—" : `${averageScore}%`}</div>
          </div>
          <div className="tp-card metric-card">
            <div className="tp-label">Pass rate</div>
            <div className="tp-mono metric-value">{passRate === null ? "—" : `${passRate}%`}</div>
          </div>
          <div className="tp-card metric-card">
            <div className="tp-label">Questions answered</div>
            <div className="tp-mono metric-value">{attemptQuestions.length}</div>
          </div>
        </div>

        <section className="profile-report-section">
          <div className="section-heading-row">
            <div>
              <div className="tp-label">Performance by question type</div>
              <span>Accuracy across this user’s completed attempts</span>
            </div>
            <span>Groups can overlap</span>
          </div>
          <div className="tp-card question-performance-card">
            <QuestionPerformance groups={questionPerformance} />
          </div>
        </section>

        <section className="profile-report-section">
          <div className="section-heading-row">
            <div>
              <div className="tp-label">Assessment attempts</div>
              <span>Open an attempt to review every question and answer</span>
            </div>
          </div>
          <div className="tp-card profile-history">
            <div className="profile-attempt-table__head">
              <div>Course</div><div>Score</div><div>Result</div><div>Mandatory</div><div>Date</div><div></div>
            </div>
            <div className="tp-scroll" style={{ maxHeight: 520, overflowY: "auto" }}>
              {completedAttempts.map((attempt) => {
                const questionSummary = questionsByAttempt.get(attempt.id) || { total: 0, mandatory: 0, mandatoryCorrect: 0 };
                const mandatoryMet = questionSummary.mandatoryCorrect === questionSummary.mandatory;
                return (
                  <div key={attempt.id} className="profile-attempt-table__row">
                    <div>
                      <strong>{attempt.courses?.title || "Course"}</strong>
                      <small>{questionSummary.total} {questionSummary.total === 1 ? "question" : "questions"}</small>
                    </div>
                    <div className="tp-mono">{attempt.score}%</div>
                    <div>
                      <span className="tp-badge" style={{ background: attempt.passed ? "var(--success-dim)" : "var(--danger-dim)", color: attempt.passed ? "var(--success)" : "var(--danger)" }}>
                        {attempt.passed ? "Passed" : "Failed"}
                      </span>
                    </div>
                    <div className={mandatoryMet ? "mandatory-status is-met" : "mandatory-status is-unmet"}>
                      {questionSummary.mandatory ? `${questionSummary.mandatoryCorrect}/${questionSummary.mandatory} correct` : "None asked"}
                    </div>
                    <div className="profile-attempt-date">{new Date(attempt.submitted_at).toLocaleDateString()}</div>
                    <div><Link href={`/profile/${person.id}/attempts/${attempt.id}`} className="tp-btn tp-btn-ghost attempt-review-link">Review</Link></div>
                  </div>
                );
              })}
              {completedAttempts.length === 0 && <div className="admin-insight-empty">No completed assessments yet.</div>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
