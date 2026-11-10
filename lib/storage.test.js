import assert from "node:assert/strict";
import test from "node:test";
import { removeStoredFiles } from "./storage.js";

function fakeSupabase(result) {
  const calls = [];
  return {
    calls,
    storage: { from: (bucket) => ({ remove: async (paths) => { calls.push({ bucket, paths }); return result(paths); } }) },
  };
}

test("reports success only when every file was removed", async () => {
  const ok = fakeSupabase((paths) => ({ data: paths.map((name) => ({ name })), error: null }));
  assert.equal(await removeStoredFiles(ok, "b", ["a.pdf", null, "c.pdf"]), true);
  assert.deepEqual(ok.calls, [{ bucket: "b", paths: ["a.pdf", "c.pdf"] }]);
});

test("treats a silent no-op (no select permission) as a failure", async (t) => {
  t.mock.method(console, "warn", () => {});
  const blocked = fakeSupabase(() => ({ data: [], error: null }));
  assert.equal(await removeStoredFiles(blocked, "b", ["a.pdf"]), false);
});

test("does nothing for an empty list", async () => {
  const supabase = fakeSupabase(() => ({ data: [], error: null }));
  assert.equal(await removeStoredFiles(supabase, "b", []), true);
  assert.equal(supabase.calls.length, 0);
});
