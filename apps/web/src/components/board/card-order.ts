import { startOfDay } from "date-fns";

/** What the order of a board card depends on. */
export type CardSortFields = {
  key: string;
  priority: string | null;
  /** ISO time or null. */
  dueDate: string | null;
  done: boolean;
};

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};
// An unknown or missing priority sorts last, like "no priority".
const NO_PRIORITY_RANK = 4;

export function priorityRank(priority: string | null) {
  return PRIORITY_RANK[priority ?? ""] ?? NO_PRIORITY_RANK;
}

/** The number in a key such as "T-19". A key without one sorts last. */
export function keyNumber(key: string) {
  const match = /(\d+)$/.exec(key);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function dueTime(card: CardSortFields) {
  if (!card.dueDate) return Number.POSITIVE_INFINITY;
  const time = new Date(card.dueDate).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

/** Due before the start of today, and not finished. */
export function isOverdue(card: CardSortFields, today: number) {
  return !card.done && dueTime(card) < today;
}

const compareNumbers = (x: number, y: number) => (x === y ? 0 : x < y ? -1 : 1);

type Rule = (a: CardSortFields, b: CardSortFields, today: number) => number;

// Rules run in order; the first one that tells two cards apart decides.
const RULES: Rule[] = [
  (a, b, today) => Number(isOverdue(b, today)) - Number(isOverdue(a, today)),
  (a, b) => priorityRank(a.priority) - priorityRank(b.priority),
  (a, b) => compareNumbers(dueTime(a), dueTime(b)),
  (a, b) => compareNumbers(keyNumber(a.key), keyNumber(b.key)),
];

export function compareCards(
  a: CardSortFields,
  b: CardSortFields,
  today: number,
) {
  for (const rule of RULES) {
    const result = rule(a, b, today);
    if (result !== 0) return result;
  }
  return 0;
}

/**
 * Cards in one column: overdue first, then priority, then the soonest due
 * date, then key number. Returns a new array.
 */
export function orderCards<T>(
  cards: T[],
  fieldsOf: (card: T) => CardSortFields,
  today = startOfDay(new Date()).getTime(),
): T[] {
  return [...cards].sort((a, b) =>
    compareCards(fieldsOf(a), fieldsOf(b), today),
  );
}
