// "Reading · p. 4", or "Reading · deck 2, p. 4" when the course has several decks.
export function readingLabel(question, materials) {
  if (materials.length < 2) return `Reading · p. ${question.page_number}`;
  const deck = materials.findIndex((material) => material.id === question.material_id) + 1;
  return `Reading · deck ${deck || "?"}, p. ${question.page_number}`;
}
