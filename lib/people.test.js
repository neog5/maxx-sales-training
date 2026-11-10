import assert from "node:assert/strict";
import test from "node:test";
import { byName, displayName, firstName, initial } from "./people.js";

test("handles people without a name", () => {
  assert.equal(initial(null), "U");
  assert.equal(initial(" ana "), "A");
  assert.equal(firstName("  Ana Ruiz "), "Ana");
  assert.equal(firstName(""), "there");
  assert.equal(displayName({ full_name: "", email: "a@b.c" }), "a@b.c");
  assert.deepEqual([{ full_name: "b" }, { full_name: null }, { full_name: "a" }].sort(byName).map((p) => p.full_name), [null, "a", "b"]);
});
