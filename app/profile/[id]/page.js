import Link from "next/link";
import LocalDate from "@/components/LocalDate";
import QuestionPerformance from "@/components/QuestionPerformance";
import StatusBadge from "@/components/StatusBadge";
import TopNav from "@/components/TopNav";
import { calculateQuestionPerformance, summarizeAnswers } from "@/lib/assessment";
import { attemptAllowance } from "@/lib/attempts";
import { requireSelfOrReports } from "@/lib/auth";
import { isRequirableCourse, passedCoursesByUser } from "@/lib/compliance";
import { fetchAll, must, mustFind } from "@/lib/db";
import { displayName, initial } from "@/lib/people";
import { fetchAssignmentsForUser } from "@/lib/queries";
import { ROLE_LABELS, assignableRoles, canViewReports, isAdmin } from "@/lib/roles";
import { routes } from "@/lib/routes";
import LockedAssessments from "./LockedAssessments";
import RequiredTraining from "./RequiredTraining";
import RoleEditor from "./RoleEditor";

// Map<key, rows>, keeping the rows' order.
function groupBy(rows, key) {
  const grouped = new Map();
  for (const row of rows) grouped.set(row[key], [...(grouped.get(row[key]) || []), row]);
  return grouped;
}

function MetricCard({ label, value }) {
  return (
    <div className="tp-card metric-card">
      <div className="tp-label">{label}</div>
      <div className="tp-mono metric-value">{value}</div>
    </div>
  );
}

const percent = (value) => (value === null ? "—" : `${value}%`);

export default async function ProfilePage({ params }) {
  const { id } = await params;
  const { supabase, profile: viewer } = await requireSelfOrReports(id);
  const rows = async (query, what) => must(await query, what) || [];

  const [person, attempts, memberships, groups, courses, certificates, unlocks, requiredRows] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role").eq("id", id).maybeSingle().then((result) => mustFind(result, "this person")),
    rows(
      supabase
        .from("quiz_attempts")
        .select("id, user_id, course_id, score, passed, submitted_at, courses(title, code)")
        .eq("user_id", id)
        .eq("status", "completed")
        .order("submitted_at", { ascending: false }),
      "attempts"
    ),
    rows(supabase.from("group_members").select("group_id").eq("user_id", id), "training group memberships"),
    rows(supabase.from("groups").select("id, name").order("name"), "training groups"),
    rows(supabase.from("courses").select("id, code, title, is_active, archived_at, view_only").order("code"), "courses"),
    rows(supabase.from("certificates").select("id, user_id, course_id, course_title, course_code, issued_at, expires_at").eq("user_id", id).order("issued_at", { ascending: false }), "certificates"),
    rows(supabase.from("attempt_unlocks").select("course_id, granted_at").eq("user_id", id), "attempt approvals"),
    rows(supabase.rpc("required_courses").eq("user_id", id), "required courses"),
  ]);

  const groupIds = memberships.map((membership) => membership.group_id);
  const attemptIds = attempts.map((attempt) => attempt.id);
  const [assignments, attemptQuestions] = await Promise.all([
    fetchAssignmentsForUser(supabase, id, groupIds),
    attemptIds.length
      ? fetchAll(
        () => supabase.from("attempt_questions").select("id, attempt_id, is_mandatory, image_url, is_correct").in("attempt_id", attemptIds).order("id"),
        "attempt questions"
      )
      : [],
  ]);

  const passedCourseIds = passedCoursesByUser(attempts, certificates).get(id) || new Set();
  const unlocksByCourse = groupBy(unlocks, "course_id");
  const lockedCourses = [];
  for (const [courseId, courseAttempts] of groupBy(attempts, "course_id")) {
    const allowance = attemptAllowance(courseAttempts, unlocksByCourse.get(courseId) || []);
    const course = courseAttempts[0].courses;
    if (allowance.locked) lockedCourses.push({ id: courseId, title: course?.title || "Course", code: course?.code || "", failed: allowance.failed });
  }

  const passedAttempts = attempts.filter((attempt) => attempt.passed).length;
  const averageScore = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / attempts.length) : null;
  const passRate = attempts.length ? Math.round((passedAttempts / attempts.length) * 100) : null;
  const questionsByAttempt = groupBy(attemptQuestions, "attempt_id");
  const roleOptions = person.id === viewer.id ? [] : assignableRoles(viewer.role, person.role);
  const name = displayName(person);
  const isSelf = person.id === viewer.id;
  const hasAttempts = attempts.length > 0;

  return (
    <div>
      <TopNav profile={viewer} />
      <main className="tp-page tp-fade-in">
        {canViewReports(viewer.role) && <Link href={routes.people} className="tp-btn tp-btn-ghost back-link">← Back to people</Link>}
        <div className="page-heading profile-heading">
          <h1 className="tp-display">{isSelf ? "Your training record" : name}</h1>
        </div>

        <section className="tp-card profile-summary">
          <div className="profile-summary__identity">
            <div className="profile-summary__avatar" aria-hidden="true">{initial(person.full_name)}</div>
            <div>
              <h2 className="profile-summary__name tp-display">{name}</h2>
              <div className="profile-summary__role">{ROLE_LABELS[person.role] || person.role}</div>
            </div>
          </div>
          {roleOptions.length > 0 && <RoleEditor profileId={person.id} initialRole={person.role} roles={roleOptions} />}
        </section>

        <RequiredTraining
          personId={person.id}
          canEdit={isAdmin(viewer.role)}
          showGroups={isAdmin(viewer.role) || (isSelf && groupIds.length > 0)}
          requiredCourseIds={requiredRows.map((row) => row.course_id)}
          groups={groups}
          initialGroupIds={groupIds}
          courses={courses.filter(isRequirableCourse)}
          initialAssignments={assignments}
          passedCourseIds={[...passedCourseIds]}
        />

        <LockedAssessments personId={person.id} viewerId={viewer.id} courses={lockedCourses} canApprove={isAdmin(viewer.role)} />

        <section className="profile-report-section">
          <div className="section-heading-row">
            <div>
              <div className="tp-label">Certificates</div>
            </div>
          </div>
          <div className="tp-card certificate-list">
            {certificates.map((certificate) => (
              <div key={certificate.id} className="certificate-list__row">
                <div>
                  <strong>{certificate.course_title}</strong>
                  <small>{certificate.course_code} · completed <LocalDate value={certificate.issued_at} />{certificate.expires_at && <> · valid until <LocalDate value={certificate.expires_at} /></>}</small>
                </div>
                <Link href={routes.certificate(certificate.id)} className="tp-btn tp-btn-ghost attempt-review-link">View</Link>
              </div>
            ))}
            {certificates.length === 0 && <div className="admin-insight-empty">No certificates yet.</div>}
          </div>
        </section>

        {hasAttempts && (
        <>
        <div className="metric-grid metric-grid--profile">
          <MetricCard label="Completed attempts" value={attempts.length} />
          <MetricCard label="Average score" value={percent(averageScore)} />
          <MetricCard label="Pass rate" value={percent(passRate)} />
          <MetricCard label="Questions answered" value={attemptQuestions.length} />
        </div>

        <section className="profile-report-section">
          <div className="section-heading-row">
            <div>
              <div className="tp-label">Performance by question type</div>
            </div>
          </div>
          <div className="tp-card question-performance-card">
            <QuestionPerformance groups={calculateQuestionPerformance(attemptQuestions)} />
          </div>
        </section>

        </>
        )}

        <section className="profile-report-section">
          <div className="section-heading-row">
            <div>
              <div className="tp-label">Assessment attempts</div>
            </div>
          </div>
          <div className="tp-card profile-history">
            <div className="profile-attempt-table__head">
              <div>Course</div><div>Score</div><div>Result</div><div>Mandatory</div><div>Date</div><div></div>
            </div>
            <div className="tp-scroll profile-history__scroll">
              {attempts.map((attempt) => {
                const summary = summarizeAnswers(questionsByAttempt.get(attempt.id) || []);
                return (
                  <div key={attempt.id} className="profile-attempt-table__row">
                    <div>
                      <strong>{attempt.courses?.title || "Course"}</strong>
                      <small>{summary.total} {summary.total === 1 ? "question" : "questions"}</small>
                    </div>
                    <div className="tp-mono">{attempt.score}%</div>
                    <div><StatusBadge tone={attempt.passed ? "success" : "danger"}>{attempt.passed ? "Passed" : "Not passed"}</StatusBadge></div>
                    <div className={summary.mandatoryPassed ? "mandatory-status is-met" : "mandatory-status is-unmet"}>
                      {summary.mandatoryCount ? `${summary.mandatoryCorrectCount} of ${summary.mandatoryCount} correct` : "—"}
                    </div>
                    <div className="profile-attempt-date"><LocalDate value={attempt.submitted_at} /></div>
                    <div><Link href={routes.attempt(person.id, attempt.id)} className="tp-btn tp-btn-ghost attempt-review-link">Review</Link></div>
                  </div>
                );
              })}
              {!hasAttempts && <div className="admin-insight-empty">No assessments taken yet.</div>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
