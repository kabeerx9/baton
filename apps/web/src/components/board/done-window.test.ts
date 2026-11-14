import { describe, expect, it } from "vite-plus/test";
import { splitDone } from "./done-window";

const NOW = new Date("2026-11-14T12:00:00Z");
const at = (finishedAt: string | null) => ({ finishedAt });

describe("splitDone", () => {
  it("keeps items finished in the last 14 days and counts the rest", () => {
    const { recent, olderCount } = splitDone(
      [
        at("2026-11-14T08:00:00Z"),
        at("2026-10-31T13:00:00Z"),
        at("2026-10-30T11:00:00Z"),
        at("2026-09-01T00:00:00Z"),
      ],
      NOW,
    );
    expect(recent).toHaveLength(2);
    expect(olderCount).toBe(2);
  });

  it("keeps an item with no finish time", () => {
    expect(splitDone([at(null)], NOW)).toEqual({
      recent: [at(null)],
      olderCount: 0,
    });
  });

  it("reports zero older when nothing is old", () => {
    expect(splitDone([], NOW)).toEqual({ recent: [], olderCount: 0 });
  });
});

describe("splitDone across midnight", () => {
  it("moves an item to older when the day advances", () => {
    const items = [at("2026-10-31T13:00:00Z")];
    expect(splitDone(items, NOW).olderCount).toBe(0);
    expect(splitDone(items, new Date("2026-11-15T12:00:00Z")).olderCount).toBe(
      1,
    );
  });
});
