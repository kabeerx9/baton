import { describe, expect, it } from "vite-plus/test";
import { keyNumber, orderCards } from "./card-order";

const TODAY = new Date(2026, 10, 14).getTime();
const day = (n: number) => new Date(2026, 10, n, 12).toISOString();

const card = (
  key: string,
  priority: string | null,
  dueDate: string | null = null,
  done = false,
) => ({ key, priority, dueDate, done });
const keys = (cards: { key: string }[]) => cards.map((c) => c.key);

describe("orderCards", () => {
  it("puts urgent, high, medium, low and none in that order", () => {
    const ordered = orderCards(
      [
        card("T-1", "no-priority"),
        card("T-2", "low"),
        card("T-3", "medium"),
        card("T-4", "high"),
        card("T-5", "urgent"),
      ],
      (c) => c,
    );
    expect(keys(ordered)).toEqual(["T-5", "T-4", "T-3", "T-2", "T-1"]);
  });

  it("orders equal priorities by key number, not as text", () => {
    const ordered = orderCards(
      [card("T-19", "high"), card("T-3", "high"), card("T-100", "high")],
      (c) => c,
    );
    expect(keys(ordered)).toEqual(["T-3", "T-19", "T-100"]);
  });

  it("treats a missing or unknown priority as no priority", () => {
    const ordered = orderCards(
      [card("T-1", null), card("T-2", "weird"), card("T-3", "low")],
      (c) => c,
    );
    expect(keys(ordered)).toEqual(["T-3", "T-1", "T-2"]);
  });

  it("does not change the input array", () => {
    const input = [card("T-2", "low"), card("T-1", "urgent")];
    orderCards(input, (c) => c);
    expect(keys(input)).toEqual(["T-2", "T-1"]);
  });
});

describe("orderCards with due dates", () => {
  const order = (cards: ReturnType<typeof card>[]) =>
    keys(orderCards(cards, (c) => c, TODAY));

  it("puts overdue first, then priority, then due date, then number", () => {
    expect(
      order([
        card("T-1", "urgent"),
        card("T-2", "low", day(20)),
        card("T-3", "high", day(15)),
        card("T-4", "high", day(18)),
        card("T-5", "low", day(10)),
        card("T-6", "medium", day(12)),
        card("T-7", "high", day(15)),
      ]),
    ).toEqual(["T-6", "T-5", "T-1", "T-3", "T-7", "T-4", "T-2"]);
  });

  it("sorts a card due today as not overdue", () => {
    expect(order([card("T-1", "low", day(14)), card("T-2", "high")])).toEqual([
      "T-2",
      "T-1",
    ]);
  });

  it("does not call finished work overdue", () => {
    expect(
      order([card("T-1", "low", day(1), true), card("T-2", "high")]),
    ).toEqual(["T-2", "T-1"]);
  });

  it("sorts a card with a due date before one with none at equal priority", () => {
    expect(order([card("T-1", "high"), card("T-2", "high", day(30))])).toEqual([
      "T-2",
      "T-1",
    ]);
  });
});

describe("orderCards across midnight", () => {
  const cards = [card("T-1", "urgent"), card("T-2", "low", day(14))];
  it("turns a card due today into overdue when the shared day moves on", () => {
    expect(keys(orderCards(cards, (c) => c, TODAY))).toEqual(["T-1", "T-2"]);
    expect(keys(orderCards(cards, (c) => c, TODAY + 86_400_000))).toEqual([
      "T-2",
      "T-1",
    ]);
  });
});

describe("keyNumber", () => {
  it("reads the trailing number and sorts a key without one last", () => {
    expect(keyNumber("API-12")).toBe(12);
    expect(keyNumber("none")).toBe(Number.POSITIVE_INFINITY);
  });
});
