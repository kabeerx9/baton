/** Where a card sits on the board. */
export type CardSpot = {
  key: string;
  column: string;
  /** Position in its column, from 0. */
  index: number;
};

/**
 * The card that takes focus when the focused card leaves the board or its
 * column. Order of preference: the card now at the same place in the same
 * column, the last card of that column, the first card of the nearest column
 * to the right, then of the nearest column to the left. `null` when the board
 * is empty. `columns` lists every column, left to right. A card in an unknown
 * column counts as having no columns to its right or left.
 */
export function focusFallback(
  lost: Pick<CardSpot, "column" | "index">,
  spots: readonly CardSpot[],
  columns: readonly string[],
): string | null {
  const inColumn = (column: string) =>
    spots.filter((spot) => spot.column === column).sort(byIndex);
  const same = inColumn(lost.column);
  const atPlace = same.find((spot) => spot.index === lost.index);
  if (atPlace) return atPlace.key;
  const last = same.at(-1);
  if (last) return last.key;

  const at = columns.indexOf(lost.column);
  if (at === -1) return null;
  const right = columns.slice(at + 1);
  const left = columns.slice(0, at).reverse();
  for (const column of [...right, ...left]) {
    const first = inColumn(column)[0];
    if (first) return first.key;
  }
  return null;
}

const byIndex = (a: CardSpot, b: CardSpot) => a.index - b.index;
