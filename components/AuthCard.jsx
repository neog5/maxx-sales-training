// The sign-in and reset-password layout: a blue brand panel beside the form.
export default function AuthCard({ children }) {
  return (
    <main className="login-page">
      <div className="login-card tp-fade-in">
        <section className="login-brand">
          <img src="/maxx-ortho-logo-white.png" alt="Maxx Orthopedics" />
          <span className="tp-display">Sales Training</span>
        </section>
        <section className="login-form">{children}</section>
      </div>
    </main>
  );
}
