// Set NEXT_PUBLIC_APP_ENV (e.g. "dev") as a build variable on non-production
// deployments. Production leaves it unset, so nothing renders there.
export const appEnv = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase() || "production";
export const isProduction = appEnv === "production";

export default function EnvironmentBanner() {
  if (isProduction) return null;
  return (
    <div className="env-banner" role="note">
      <strong>{appEnv.toUpperCase()} environment</strong> · Test site with test data. This is not the live training portal.
    </div>
  );
}
