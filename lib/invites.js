// Invite-only sign-up: admins invite email addresses, and only those can create an account
// (the database enforces it, migration 012).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sorts a pasted list of email addresses (separated by commas, semicolons, spaces or new
// lines) into the ones to invite and the ones to leave out, with why.
//   existingEmails: people who already have an account. invitedEmails: invites not used yet.
export function parseInviteEmails(text, { existingEmails = [], invitedEmails = [] } = {}) {
  const normalize = (email) => String(email || "").trim().toLowerCase();
  const existing = new Set(existingEmails.map(normalize));
  const invited = new Set(invitedEmails.map(normalize));
  const result = { emails: [], invalid: [], existing: [], alreadyInvited: [] };
  const seen = new Set();
  for (const raw of String(text || "").split(/[\s,;]+/)) {
    // Tolerate "Name <email>" pastes from mail apps.
    const email = normalize(raw.replace(/^<|>$/g, ""));
    if (!email || seen.has(email)) continue;
    seen.add(email);
    if (!EMAIL.test(email)) result.invalid.push(email);
    else if (existing.has(email)) result.existing.push(email);
    else if (invited.has(email)) result.alreadyInvited.push(email);
    else result.emails.push(email);
  }
  return result;
}

// What Supabase returns when the database refuses a sign-up (the trigger's own message
// isn't passed on), turned into something the person can act on.
export function signUpErrorMessage(message) {
  return /database error saving new user|not been invited/i.test(message || "")
    ? "This email address hasn’t been invited yet. Ask your admin for an invite, then sign up with the exact address they invited."
    : message;
}
