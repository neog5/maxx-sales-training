function Skeleton({ className = "", style }) {
  return <span className={`tp-skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}

export function SkeletonPage({ children, className = "" }) {
  return (
    <div className={`tp-skeleton-page ${className}`.trim()} aria-busy="true" aria-label="Loading content">
      {children}
      <span className="tp-sr-only" role="status">Loading content…</span>
    </div>
  );
}

export function TopNavSkeleton() {
  return (
    <header className="site-nav" aria-hidden="true">
      <div className="site-nav__inner">
        <div className="site-brand">
          <Skeleton className="skeleton-nav-logo" />
          <Skeleton className="skeleton-nav-title" />
        </div>
        <div className="skeleton-nav-actions">
          <Skeleton className="skeleton-nav-links" />
          <Skeleton className="skeleton-nav-avatar" />
        </div>
      </div>
    </header>
  );
}

function PageHeadingSkeleton({ compact = false }) {
  return (
    <div className="page-heading skeleton-heading">
      <Skeleton className="skeleton-eyebrow" />
      <Skeleton className={compact ? "skeleton-title skeleton-title--compact" : "skeleton-title"} />
      {!compact && <Skeleton className="skeleton-copy" />}
    </div>
  );
}

export function CoursesSkeleton({ showNav = true }) {
  return (
    <SkeletonPage>
      {showNav && <TopNavSkeleton />}
      <main className="tp-page tp-page-narrow">
        <PageHeadingSkeleton />
        <div className="course-list">
          {[0, 1, 2].map((item) => (
            <div className="tp-card course-card skeleton-course-card" key={item}>
              <div className="course-card__content">
                <div className="skeleton-inline"><Skeleton className="skeleton-code" /><Skeleton className="skeleton-badge" /></div>
                <Skeleton className="skeleton-course-title" />
                <Skeleton className="skeleton-course-copy" />
                <div className="course-steps">
                  <Skeleton className="skeleton-step" />
                  <Skeleton className="skeleton-step" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </SkeletonPage>
  );
}

export function AssessmentSkeleton({ showNav = true }) {
  return (
    <SkeletonPage>
      {showNav && <TopNavSkeleton />}
      <main className="assessment-page">
        <Skeleton className="skeleton-eyebrow" />
        <div className="skeleton-assessment-heading"><Skeleton className="skeleton-title skeleton-title--compact" /><Skeleton className="skeleton-count" /></div>
        <Skeleton className="skeleton-copy skeleton-copy--short" />
        <div className="skeleton-question-list">
          {[0, 1, 2].map((item) => (
            <div className="tp-card assessment-card" key={item}>
              <div className="skeleton-inline skeleton-question-line"><Skeleton className="skeleton-number" /><Skeleton className="skeleton-question-text" /></div>
              <div className="skeleton-option-list">
                {[0, 1, 2, 3].map((option) => <Skeleton className="skeleton-option" key={option} />)}
              </div>
            </div>
          ))}
        </div>
      </main>
    </SkeletonPage>
  );
}

export function ReadingSkeleton({ showNav = true }) {
  return (
    <SkeletonPage>
      {showNav && <TopNavSkeleton />}
      <main className="reading-shell">
        <Skeleton className="skeleton-back-button" />
        <Skeleton className="skeleton-eyebrow" />
        <Skeleton className="skeleton-reading-title" />
        <div className="skeleton-reading-workspace">
          <section>
            <div className="skeleton-reader-labels"><Skeleton className="skeleton-code" /><Skeleton className="skeleton-page-label" /></div>
            <div className="tp-card skeleton-pdf-frame">
              <Skeleton className="skeleton-pdf-toolbar" />
              <Skeleton className="skeleton-pdf-page" />
            </div>
          </section>
          <div className="tp-card skeleton-reading-panel">
            <Skeleton className="skeleton-panel-progress" />
            <Skeleton className="skeleton-badge" />
            <Skeleton className="skeleton-panel-question" />
            <Skeleton className="skeleton-option" />
            <Skeleton className="skeleton-option" />
            <Skeleton className="skeleton-option" />
          </div>
        </div>
      </main>
    </SkeletonPage>
  );
}

function AdminFrame({ children, activeWidth = 310 }) {
  return (
    <SkeletonPage>
      <TopNavSkeleton />
      <div className="admin-nav"><Skeleton className="skeleton-admin-tabs" style={{ width: activeWidth }} /></div>
      {children}
    </SkeletonPage>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <AdminFrame>
      <main className="tp-page">
        <PageHeadingSkeleton />
        <div className="metric-grid metric-grid--admin">
          {[0, 1, 2, 3].map((item) => <div className="tp-card metric-card skeleton-metric" key={item}><Skeleton className="skeleton-metric-label" /><Skeleton className="skeleton-metric-value" /></div>)}
        </div>
        <Skeleton className="skeleton-table-label" />
        <div className="tp-card skeleton-table">
          <Skeleton className="skeleton-table-head" />
          {[0, 1, 2, 3, 4].map((item) => <div className="skeleton-table-row" key={item}><Skeleton /><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>)}
        </div>
      </main>
    </AdminFrame>
  );
}

export function AdminFormSkeleton() {
  return (
    <AdminFrame>
      <main className="tp-form-page">
        <PageHeadingSkeleton />
        <div className="tp-card tp-form-card skeleton-form">
          <div className="tp-form-grid"><Skeleton className="skeleton-field" /><Skeleton className="skeleton-field" /></div>
          <Skeleton className="skeleton-field skeleton-field--textarea" />
          <Skeleton className="skeleton-field" />
          <div className="tp-form-grid tp-form-grid--equal"><Skeleton className="skeleton-field" /><Skeleton className="skeleton-field" /></div>
          <Skeleton className="skeleton-form-button" />
        </div>
      </main>
    </AdminFrame>
  );
}

export function QuestionBankSkeleton() {
  return (
    <AdminFrame>
      <main className="bank-page">
        <div className="bank-heading skeleton-bank-heading"><PageHeadingSkeleton compact /><Skeleton className="skeleton-add-button" /></div>
        <Skeleton className="skeleton-filter" />
        <div className="question-list">
          {[0, 1, 2, 3].map((item) => <div className="tp-card question-item skeleton-question-item" key={item}><div><Skeleton className="skeleton-badge" /><Skeleton className="skeleton-bank-question" /></div><Skeleton className="skeleton-row-actions" /></div>)}
        </div>
      </main>
    </AdminFrame>
  );
}

export function ProfileSkeleton() {
  return (
    <SkeletonPage>
      <TopNavSkeleton />
      <main className="tp-page tp-page-narrow">
        <PageHeadingSkeleton compact />
        <div className="tp-card profile-summary">
          <div className="profile-summary__identity"><Skeleton className="skeleton-profile-avatar" /><div><Skeleton className="skeleton-profile-name" /><Skeleton className="skeleton-profile-role" /></div></div>
          <Skeleton className="skeleton-role-editor" />
        </div>
        <Skeleton className="skeleton-table-label" />
        <div className="tp-card skeleton-table">
          <Skeleton className="skeleton-table-head" />
          {[0, 1, 2, 3].map((item) => <div className="skeleton-table-row skeleton-table-row--profile" key={item}><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>)}
        </div>
      </main>
    </SkeletonPage>
  );
}

export function AppSkeleton() {
  return <CoursesSkeleton />;
}

export default Skeleton;
