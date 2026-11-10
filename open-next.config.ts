// Stays a .ts file in this JS project: the OpenNext CLI looks for exactly this filename.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every route is dynamic (Supabase auth), so no R2 incremental cache is needed.
export default defineCloudflareConfig();
