import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every route is dynamic (Supabase auth), so no R2 incremental cache is needed.
export default defineCloudflareConfig();
