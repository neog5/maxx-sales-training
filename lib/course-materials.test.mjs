import test from "node:test";
import assert from "node:assert/strict";
import { materialStoragePath, materialStoragePathFromUrl, reorderedPositions, titleFromFileName } from "./course-materials.mjs";

test("stores decks under the course code with a safe file name", () => {
  assert.equal(materialStoragePath("HOSP-101", "OR Protocols (v2).PDF", "abc"), "hosp-101/abc-or-protocols-v2-.pdf");
  assert.equal(materialStoragePath("X", "###", "abc"), "x/abc-course.pdf");
});

test("finds the bucket path of stored decks only", () => {
  assert.equal(materialStoragePathFromUrl("https://p.supabase.co/storage/v1/object/public/course-pdfs/hosp-101/a%20b.pdf"), "hosp-101/a b.pdf");
  assert.equal(materialStoragePathFromUrl("/sample-course.pdf"), null);
  assert.equal(materialStoragePathFromUrl(null), null);
});

test("turns file names into readable deck titles", () => {
  assert.equal(titleFromFileName("328-2-bloodborne_pathogens.pdf"), "328 2 bloodborne pathogens");
  assert.equal(titleFromFileName(".pdf"), "Course document");
});

test("renumbers only the decks whose position changes", () => {
  const decks = [{ id: "a", position: 1 }, { id: "b", position: 2 }, { id: "c", position: 3 }];
  assert.deepEqual(reorderedPositions(decks, 2, 1), [{ id: "c", position: 2 }, { id: "b", position: 3 }]);
  assert.deepEqual(reorderedPositions(decks, 0, -1), []);
  // Gaps from removed decks are closed up.
  assert.deepEqual(reorderedPositions([{ id: "a", position: 1 }, { id: "c", position: 3 }], 1, 0), [{ id: "c", position: 1 }, { id: "a", position: 2 }]);
});
