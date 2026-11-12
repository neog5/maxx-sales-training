// Loading placeholders shown by each route's loading.js while the page's data loads.
// Each one reuses the real page's elements and classes (headings, labels, grids, table
// columns) with grey bars in place of the text, so spacing, line heights and mobile
// breakpoints come from the same CSS as the loaded page.

function Skeleton({ className = "", style }) {
  return <i className={`tp-skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}

// A block-level bar: an input, a button, a picture.
function Bar({ w = "100%", h = 14, r, style }) {
  return <Skeleton style={{ width: w, height: h, ...(r !== undefined && { borderRadius: r }), ...style }} />;
}

// A bar that sits inside a line of text, so the element keeps its own line height.
function T({ w = 120, h = 12 }) {
  return <Skeleton className="skeleton-text" style={{ width: w, height: h }} />;
}

function SkeletonPage({ children }) {
  return (
    <div className="tp-skeleton-page" aria-busy="true" aria-label="Loading content">
      {children}
      <span className="tp-sr-only" role="status">Loading content…</span>
    </div>
  );
}

const range = (count) => Array.from({ length: count }, (_, index) => index);
const INPUT = 46;
const BUTTON = 40;

// The real logo and title, which never change; only the links and avatar are placeholders.
function TopNavSkeleton() {
  return (
    <header className="site-nav" aria-hidden="true">
      <div className="site-nav__inner">
        <div className="site-brand">
          <img className="site-brand__logo" src="/maxx-ortho-logo.png" alt="" />
          <span className="tp-display site-brand__title">Sales Training</span>
        </div>
        <div className="site-nav__actions">
          <Skeleton className="skeleton-nav-links" />
          <div className="site-nav__account"><Bar w={40} h={40} r="50%" /></div>
        </div>
      </div>
    </header>
  );
}

function BackLink({ w = 130 }) {
  return <div className="tp-btn tp-btn-ghost back-link"><span><T w={w} h={13} /></span></div>;
}

// .page-heading content: optional label, the title and up to a few lines of intro.
function Heading({ label, title = 260, lines = [] }) {
  return (
    <>
      {label && <div className="tp-label"><T w={label} /></div>}
      <h1 className="tp-display"><T w={title} h={28} /></h1>
      {lines.length > 0 && <p>{lines.map((w, index) => <span key={index}>{index > 0 && <br />}<T w={w} h={13} /></span>)}</p>}
    </>
  );
}

// A .section-heading-row: the small label, plus an optional note under it.
function SectionLabel({ w = 120, note }) {
  return (
    <div className="section-heading-row">
      <div>
        <div className="tp-label"><T w={w} /></div>
        {note && <span><T w={note} h={10} /></span>}
      </div>
    </div>
  );
}

// A table built from the page's own grid classes: `${name}__head` and `${name}__row`.
// `twoLine` columns get a second, smaller line, like a name over an email; `people`
// starts each row with an avatar, as PersonIdentity does.
function TableSkeleton({ name, cardClass = name, columns, rows = 5, twoLine = [0], people = false }) {
  return (
    <div className={`tp-card ${cardClass}`}>
      <div className={`${name}__head`}>{range(columns).map((column) => <div key={column}><T w={column === columns - 1 ? 0 : 60} h={10} /></div>)}</div>
      {range(rows).map((row) => (
        <div className={`${name}__row`} key={row}>
          {range(columns).map((column) => {
            const lines = (
              <div className="skeleton-cell skeleton-grow">
                <T w={column === 0 ? "70%" : "55%"} />
                {twoLine.includes(column) && <T w="40%" h={10} />}
              </div>
            );
            return people && column === 0
              ? <div key={column} className="people-identity"><Bar w={34} h={34} r="50%" style={{ flex: "0 0 auto" }} />{lines}</div>
              : <div key={column}>{lines}</div>;
          })}
        </div>
      ))}
    </div>
  );
}

function MetricCards({ count, className, withNote = false }) {
  return (
    <div className={`metric-grid ${className}`}>
      {range(count).map((item) => (
        <div className="tp-card metric-card" key={item}>
          <div className="tp-label"><T w={110} /></div>
          <div className="tp-mono metric-value"><T w={80} h={28} /></div>
          {withNote && <small><T w={130} h={10} /></small>}
        </div>
      ))}
    </div>
  );
}

function QuestionPerformanceSkeleton({ compact = false }) {
  return (
    <div className="tp-card question-performance-card">
      <div className={`question-performance ${compact ? "is-compact" : ""}`}>
        {range(4).map((item) => (
          <div className="question-performance__item" key={item}>
            <div className="question-performance__heading">
              <span className="skeleton-cell"><T w={110} /><T w={150} h={10} /></span>
              <T w={36} />
            </div>
            <div className="question-performance__track" />
            <div className="question-performance__detail"><T w={100} h={10} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label = 120, h = INPUT, hint }) {
  return (
    <div className="tp-form-field">
      <div className="tp-label form-label"><T w={label} /></div>
      <Bar h={h} r={10} />
      {hint && <div className="form-hint"><T w={hint} h={10} /></div>}
    </div>
  );
}

function CheckRow({ w, last = false }) {
  return <div className={`check-row ${last ? "check-row--last" : ""}`}><Bar w={16} h={16} r={4} /><span className="skeleton-grow"><T w={w} h={13} /></span></div>;
}

// A page-heading button: a real (blank) button shape, so it stretches on phones as the real one does.
function HeadingButton({ w }) {
  return <span className="tp-btn tp-btn-ghost"><span><T w={w} h={12} /></span></span>;
}

// A MultiPicker: search box and its button.
function PickerSkeleton() {
  return <div className="picker"><div className="picker__bar"><Bar h={INPUT} r={10} /><Bar w={84} h={INPUT} r={12} /></div></div>;
}

// Learner pages ------------------------------------------------------------

function CourseCardSkeleton() {
  return (
    <div className="tp-card course-card">
      <div className="course-card__cover course-card__cover--new">
        <h3 className="tp-display course-card__title"><T w={190} h={17} /></h3>
        <Bar w={34} h={34} r={8} />
      </div>
      <div className="course-card__meta"><Bar w={96} h={26} r={999} /></div>
      <p className="course-card__description"><T w="85%" h={13} /></p>
      <ol className="course-steps">
        {[130, 160, 150].map((w) => (
          <li className="course-step" key={w}><span className="course-step__mark" /><span><T w={w} h={13} /></span></li>
        ))}
      </ol>
      <div className="course-card__actions"><Bar h={48} r={12} /></div>
    </div>
  );
}

export function CoursesSkeleton() {
  return (
    <SkeletonPage>
      <TopNavSkeleton />
      <main className="tp-page courses-page">
        <section className="courses-hero">
          <div><h1 className="tp-display"><T w="min(400px, 70vw)" h={28} /></h1></div>
          <div className="courses-hero__summary">
            <span><T w={200} h={13} /></span>
            <div className="courses-hero__bar" />
          </div>
        </section>
        <div className="course-search"><Bar h={56} r={14} /></div>
        <section className="course-section">
          <div className="section-heading">
            <h2 className="tp-display"><T w={200} h={20} /></h2>
            <span><T w={100} h={12} /></span>
          </div>
          <div className="course-list">{range(4).map((item) => <CourseCardSkeleton key={item} />)}</div>
        </section>
      </main>
    </SkeletonPage>
  );
}

// `showNav` is false when the quiz shows this inside a page that already has the top bar.
export function AssessmentSkeleton({ showNav = true }) {
  const body = (
    <main className="assessment-page">
      <BackLink />
      <header className="assessment-header">
        <div className="tp-label"><T w={220} /></div>
        <div className="assessment-header__title">
          <h1 className="tp-display"><T w={180} h={26} /></h1>
          <span><T w={110} /></span>
        </div>
        <div className="assessment-progress" />
        <p><T w="96%" h={14} /><br /><T w="62%" h={14} /></p>
      </header>
      <div className="assessment-list">
        {range(3).map((item) => (
          <div className="tp-card assessment-card" key={item}>
            <div className="assessment-question">
              <span className="assessment-question__number" />
              <h2><T w="88%" h={15} /><br /><T w="50%" h={15} /></h2>
            </div>
            <div className="assessment-options">{range(4).map((option) => <Bar key={option} h={52} r={11} />)}</div>
          </div>
        ))}
      </div>
    </main>
  );
  if (!showNav) {
    return (
      <div aria-busy="true" aria-label="Loading assessment">
        {body}
        <span className="tp-sr-only" role="status">Loading assessment…</span>
      </div>
    );
  }
  return <SkeletonPage><TopNavSkeleton />{body}</SkeletonPage>;
}

export function ReadingSkeleton() {
  return (
    <SkeletonPage>
      <TopNavSkeleton />
      <main className="reading-shell">
        <BackLink />
        <header className="reading-header">
          <div><h1 className="tp-display"><T w="min(420px, 70vw)" h={26} /></h1></div>
          <div className="reading-header__step"><span>1</span> Reading <b>→</b> <span>2</span> <T w={84} h={13} /></div>
        </header>
        <div className="reading-workspace">
          <section>
            <div className="reader-heading"><span /><span className="reader-heading__hint"><T w={230} /></span></div>
            <div className="tp-card reader-frame">
              <div className="pdf-viewer-shell">
                <div className="pdf-toolbar" />
                <div className="pdf-progress-track" />
                <div className="pdf-scroll-region"><div className="pdf-loading-skeleton"><div className="pdf-loading-page" /></div></div>
              </div>
            </div>
          </section>
          <aside className="reading-question-panel">
            <div className="reading-status-card">
              <div className="reading-status-card__heading">
                <div><span className="tp-label"><T w={100} /></span><strong className="tp-display"><T w={130} h={17} /></strong></div>
                <Bar w={52} h={52} r="50%" />
              </div>
              {[110, 140].map((w) => (
                <div className="reading-progress-row" key={w}>
                  <div><span><T w={w} /></span></div>
                  <div className="reading-progress-track" />
                </div>
              ))}
            </div>
            <div className="tp-card reading-question-card">
              <div className="tp-label checkpoint-idle__label"><T w={130} /></div>
              <div className="checkpoint-idle__copy"><T w="92%" /><br /><T w="70%" /></div>
            </div>
          </aside>
        </div>
      </main>
    </SkeletonPage>
  );
}

export function ProfileSkeleton() {
  return (
    <SkeletonPage>
      <TopNavSkeleton />
      <main className="tp-page">
        <BackLink />
        <div className="page-heading profile-heading"><h1 className="tp-display"><T w={300} h={28} /></h1></div>
        <section className="tp-card profile-summary">
          <div className="profile-summary__identity">
            <Bar w={52} h={52} r="50%" />
            <div>
              <h2 className="profile-summary__name tp-display"><T w={180} h={19} /></h2>
              <div className="profile-summary__role"><T w={70} /></div>
            </div>
          </div>
        </section>
        <section className="profile-report-section">
          <SectionLabel w={140} note={200} />
          <div className="tp-card tp-form-card required-training">
            <div className="course-admin__subhead course-admin__subhead--first"><T w={80} /></div>
            {range(3).map((item) => <Bar key={item} h={44} r={10} style={{ marginTop: 8 }} />)}
          </div>
        </section>
        <section className="profile-report-section">
          <SectionLabel w={100} />
          <div className="tp-card certificate-list">
            {range(2).map((item) => (
              <div className="certificate-list__row" key={item}>
                <div className="skeleton-cell"><T w={220} h={14} /><T w={300} h={11} /></div>
                <Bar w={64} h={BUTTON} r={12} />
              </div>
            ))}
          </div>
        </section>
        <section className="profile-report-section">
          <SectionLabel w={160} />
          <TableSkeleton name="profile-attempt-table" cardClass="profile-history" columns={6} rows={4} />
        </section>
      </main>
    </SkeletonPage>
  );
}

export function AttemptReviewSkeleton() {
  return (
    <SkeletonPage>
      <TopNavSkeleton />
      <main className="tp-page attempt-detail-page">
        <BackLink w={150} />
        <div className="page-heading attempt-detail-heading">
          <div><Heading label={110} title={340} lines={[280]} /></div>
          <Bar w={70} h={33} r={999} />
        </div>
        <MetricCards count={3} className="metric-grid--attempt" withNote />
        <section className="profile-report-section">
          <SectionLabel w={200} />
          <QuestionPerformanceSkeleton />
        </section>
        <section className="attempt-question-section">
          <SectionLabel w={130} />
          <div className="attempt-question-list">
            {range(3).map((item) => (
              <div className="tp-card attempt-question" key={item}>
                <div className="attempt-question__header">
                  <span className="assessment-question__number" />
                  <div className="skeleton-cell skeleton-grow"><Bar w={90} h={22} r={999} /><T w="80%" h={15} /></div>
                </div>
                <div className="attempt-question__options">{range(4).map((option) => <Bar key={option} h={44} r={11} style={{ marginBottom: 8 }} />)}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </SkeletonPage>
  );
}

export function CertificateSkeleton() {
  return (
    <SkeletonPage>
      <TopNavSkeleton />
      <main className="tp-page certificate-page">
        <BackLink w={150} />
        <div className="page-heading certificate-heading">
          <Bar w={72} h={72} r="50%" />
          <div className="skeleton-grow"><Heading label={180} title="min(380px, 70%)" lines={["min(600px, 95%)", 160]} /></div>
        </div>
        <section className="certificate-viewer">
          <div className="certificate-actions"><Bar w={140} h={BUTTON} r={12} /><Bar w={130} h={BUTTON} r={12} /></div>
          <div className="tp-card certificate-preview"><Skeleton className="certificate-preview__skeleton" /></div>
        </section>
      </main>
    </SkeletonPage>
  );
}

// Admin pages --------------------------------------------------------------

function AdminFrame({ children }) {
  return (
    <SkeletonPage>
      <TopNavSkeleton />
      <div className="admin-nav">
        <div className="admin-tabs">
          {[74, 46, 104, 56, 58].map((w) => <span className="tp-btn admin-tabs__tab" key={w}><span><T w={w} /></span></span>)}
        </div>
      </div>
      {children}
    </SkeletonPage>
  );
}

export function ComplianceDashboardSkeleton() {
  return (
    <AdminFrame>
      <main className="tp-page">
        <div className="page-heading section-heading-row">
          <div><Heading title={180} lines={["min(600px, 80vw)", 140]} /></div>
          <HeadingButton w={86} />
        </div>
        <section className="group-summary">
          {range(4).map((item) => (
            <div className="tp-card group-summary__item" key={item}>
              <span><T w="70%" /></span>
              <strong className="tp-mono"><T w={56} h={22} /></strong>
              <small><T w={70} h={10} /></small>
            </div>
          ))}
        </section>
        <div className="watchlists">
          <div className="watchlists__row"><span className="watchlists__label"><T w={90} /></span><Bar w={230} h={30} r={999} /></div>
        </div>
        <section className="tp-card directory-toolbar compliance-toolbar">
          <Bar h={INPUT} r={10} />
          <Bar h={INPUT} r={10} />
          <div className="status-filter">{[48, 120, 100, 104].map((w) => <span className="skeleton-filter-option" key={w}><T w={w} h={11} /></span>)}</div>
        </section>
        <div className="directory-result-count"><T w={150} h={10} /></div>
        <TableSkeleton name="compliance-table" columns={4} rows={8} twoLine={[0, 3]} people />
      </main>
    </AdminFrame>
  );
}

export function CoursesAdminSkeleton() {
  return (
    <AdminFrame>
      <main className="tp-page">
        <div className="page-heading section-heading-row">
          <div><Heading title={130} /></div>
          <HeadingButton w={100} />
        </div>
        {[8, 2].map((rows, index) => (
          <section className="profile-report-section" key={index}>
            <SectionLabel w={130} note={80} />
            <TableSkeleton name="course-admin-table" columns={6} rows={rows} />
          </section>
        ))}
      </main>
    </AdminFrame>
  );
}

function CourseHeaderSkeleton() {
  return (
    <>
      <BackLink w={90} />
      <div className="page-heading"><Heading label={90} title="min(380px, 75%)" lines={[130]} /></div>
      <nav className="course-tabs">
        <a><T w={66} /></a>
        <a><T w={84} /></a>
      </nav>
    </>
  );
}

export function CourseAdminSkeleton() {
  return (
    <AdminFrame>
      <main className="tp-page">
        <CourseHeaderSkeleton />
        <div className="course-admin">
          <div className="course-admin__grid">
            <div className="tp-card tp-form-card">
              <div className="tp-label form-section-label"><T w={110} /></div>
              <Field label={40} />
              <Field label={90} h={97} />
              <div className="tp-form-grid tp-form-grid--equal"><Field label={120} /><Field label={190} /></div>
              <CheckRow w="80%" />
              <CheckRow w={130} last />
              <div className="tp-form-actions"><Bar w={120} h={BUTTON} r={12} /></div>
            </div>
            <div className="tp-card tp-form-card">
              <div className="tp-label form-section-label--tight"><T w={200} /></div>
              <p className="course-admin__hint"><T w="95%" h={11} /><br /><T w="60%" h={11} /></p>
              <div className="course-admin__subhead"><T w={110} /></div>
              <div className="chip-list"><Bar w={150} h={28} r={999} /></div>
              <PickerSkeleton />
              <div className="course-admin__subhead"><T w={110} /></div>
              <PickerSkeleton />
              <Bar h={42} r={10} />
            </div>
          </div>
          <div className="tp-card tp-form-card">
            <div className="tp-label form-section-label"><T w={100} /></div>
            {range(2).map((item) => <Bar key={item} h={44} r={10} style={{ marginBottom: 8 }} />)}
          </div>
        </div>
      </main>
    </AdminFrame>
  );
}

export function QuestionBankSkeleton() {
  return (
    <AdminFrame>
      <main className="tp-page">
        <CourseHeaderSkeleton />
        <section className="bank-page is-embedded">
          <div className="bank-heading">
            <div>
              <div className="tp-label"><T w={110} /></div>
              <span className="bank-heading__counts"><T w={160} h={11} /></span>
            </div>
            <HeadingButton w={100} />
          </div>
          <div className="suggestion-launch"><span><T w={200} /></span><Bar w={180} h={BUTTON} r={12} /></div>
          <div className="question-list">
            {range(5).map((item) => (
              <div className="tp-card question-item" key={item}>
                <div className="question-item__body">
                  <div className="question-item__badges"><Bar w={70} h={24} r={999} /><Bar w={76} h={24} r={999} /></div>
                  <div className="question-item__text"><T w="80%" h={13} /></div>
                </div>
                <div className="question-item__actions"><Bar w={52} h={BUTTON} r={12} /><Bar w={68} h={BUTTON} r={12} /></div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </AdminFrame>
  );
}

export function NewCourseSkeleton() {
  return (
    <AdminFrame>
      <main className="tp-form-page">
        <div className="tp-form-heading">
          <h1 className="tp-display"><T w={180} h={26} /></h1>
          <p><T w="min(470px, 90%)" h={13} /></p>
        </div>
        <div className="tp-card tp-form-card">
          <div className="tp-form-grid"><Field label={90} /><Field label={90} /></div>
          <Field label={90} h={97} />
          <Field label={110} hint="min(560px, 90%)" />
          <CheckRow w="75%" />
          <div className="tp-form-grid tp-form-grid--equal"><Field label={120} /><Field label={190} /></div>
          <CheckRow w={280} last />
          <div className="tp-form-actions"><Bar w={290} h={BUTTON} r={12} style={{ maxWidth: "100%" }} /></div>
        </div>
      </main>
    </AdminFrame>
  );
}

export function InsightsSkeleton() {
  return (
    <AdminFrame>
      <main className="tp-page">
        <div className="page-heading"><Heading title={300} /></div>
        <MetricCards count={4} className="metric-grid--admin" />
        <div className="admin-insight-grid">
          <section>
            <SectionLabel w={150} note={130} />
            <div className="tp-card user-performance-list">
              {range(6).map((item) => (
                <div className="user-performance-list__item" key={item}>
                  <span className="skeleton-cell"><T w={150} h={13} /><T w={120} h={10} /></span>
                  <span className="skeleton-cell user-performance-list__scores"><T w={44} h={13} /><T w={60} h={10} /></span>
                </div>
              ))}
            </div>
          </section>
          <section>
            <SectionLabel w={200} />
            <QuestionPerformanceSkeleton compact />
          </section>
        </div>
        <section className="attempt-log-section">
          <SectionLabel w={100} />
          <TableSkeleton name="attempt-table" columns={7} rows={8} twoLine={[]} />
        </section>
      </main>
    </AdminFrame>
  );
}

export function PeopleSkeleton() {
  return (
    <AdminFrame>
      <main className="tp-page people-page">
        <div className="page-heading people-heading">
          <div><Heading title={110} /></div>
          <div className="people-summary">{[60, 100, 90].map((w) => <span key={w}><T w={w} h={10} /></span>)}</div>
        </div>
        <section className="tp-card directory-toolbar">{range(4).map((item) => <Bar key={item} h={INPUT} r={10} />)}</section>
        <div className="directory-result-count"><T w={150} h={10} /></div>
        <TableSkeleton name="people-table" columns={7} rows={8} people />
      </main>
    </AdminFrame>
  );
}

export function TrainingGroupsSkeleton() {
  return (
    <AdminFrame>
      <main className="tp-page">
        <div className="page-heading"><Heading title={240} lines={["min(600px, 85vw)", "min(600px, 85vw)", 200]} /></div>
        <div className="groups-layout">
          <aside className="tp-card groups-list">
            <div className="groups-list__create"><Bar h={44} r={10} /><Bar w={58} h={BUTTON} r={12} /></div>
            {range(5).map((item) => (
              <div className="groups-list__item" key={item}><strong><T w="70%" h={13} /></strong><small><T w="55%" h={10} /></small></div>
            ))}
          </aside>
          <section className="tp-card tp-form-card group-detail">
            <div className="group-detail__header">
              <div><h2 className="tp-display"><T w={200} h={20} /></h2><p><T w={260} h={12} /></p></div>
              <div className="group-detail__actions"><Bar w={140} h={BUTTON} r={12} /><Bar w={56} h={BUTTON} r={12} /><Bar w={68} h={BUTTON} r={12} /></div>
            </div>
            <div className="course-admin__subhead"><T w={100} /></div>
            <PickerSkeleton />
            {range(3).map((item) => <Bar key={item} h={38} r={8} style={{ marginBottom: 6 }} />)}
            <div className="course-admin__subhead"><T w={140} /></div>
            <div className="chip-list"><Bar w={220} h={28} r={999} /></div>
            <PickerSkeleton />
          </section>
        </div>
      </main>
    </AdminFrame>
  );
}

// A plain page for routes without their own skeleton (sign-in, redirects), so they
// never flash a layout that isn't theirs.
export function BlankSkeleton() {
  return <SkeletonPage />;
}

export default Skeleton;
