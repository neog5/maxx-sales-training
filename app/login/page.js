import LoginForm from "./LoginForm";

// Sign in, create an account (invite only) or reset a password.
export default async function LoginPage({ searchParams }) {
  const { signup, email } = await searchParams;
  return <LoginForm initialMode={signup ? "signup" : "signin"} initialEmail={typeof email === "string" ? email.slice(0, 320) : ""} />;
}
