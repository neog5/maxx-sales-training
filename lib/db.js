import { notFound } from "next/navigation";

// Helpers for Supabase query results. Every read should go through `must` (or check
// `error` itself) so a failed query surfaces instead of rendering as "no data".

// Returns `data`, or throws so the nearest error.js boundary shows a failure.
export function must({ data, error }, what = "data") {
  if (error) throw new Error(`Could not load ${what}: ${error.message}`);
  return data;
}

// Loads one row for a page addressed by id: a missing row (or an id that isn't a valid
// uuid, Postgres code 22P02) shows the 404 page; any other failure goes to error.js.
export function mustFind(result, what) {
  if (result.error?.code === "22P02") notFound();
  const row = must(result, what);
  if (!row) notFound();
  return row;
}

// PostgREST caps each response (1000 rows by default), so large tables are read in pages.
// `buildQuery()` must return a fresh, ordered query each call (ordering keeps pages stable).
export async function fetchAll(buildQuery, what = "data", pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const page = must(await buildQuery().range(from, from + pageSize - 1), what) || [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

// Postgres error codes turned into messages people can act on.
export function friendlyDbError(error, messages = {}) {
  if (!error) return "";
  if (error.code === "23505") return messages.duplicate || "That already exists.";
  if (error.code === "23503") return messages.inUse || "This is still in use, so it can't be removed.";
  return messages.fallback || error.message;
}
