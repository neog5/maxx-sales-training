// Public Supabase settings shared by the browser, server and middleware clients.
// Both values are safe to expose; row-level security is what protects the data.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
