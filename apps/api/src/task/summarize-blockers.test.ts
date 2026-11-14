import { describe, expect, it } from "vite-plus/test";
import { type BlockLink, summarizeBlockers } from "./summarize-blockers";

const link = (overrides: Partial<BlockLink>): BlockLink => ({
  blockedId: "a",
  blockerId: "b",
  isOpen: true,
  visible: true,
  title: "Blocker",
  number: 3,
  slug: "API",
  assigneeName: "Aakash",
  ...overrides,
});

describe("summarizeBlockers", () => {
  it("lists a visible open blocker by key, title and owner", () => {
    const result = summarizeBlockers([link({})], new Set(["a"]));
    expect(result.get("a")).toEqual({
      waitsOn: [
        { id: "b", key: "API-3", title: "Blocker", assigneeName: "Aakash" },
      ],
      hiddenBlockers: 0,
    });
  });

  it("counts a hidden blocker and carries nothing else about it", () => {
    const result = summarizeBlockers(
      [link({ visible: false, title: "Secret", slug: "SEC" })],
      new Set(["a"]),
    );
    expect(result.get("a")).toEqual({ waitsOn: [], hiddenBlockers: 1 });
    expect(JSON.stringify([...result])).not.toMatch(/Secret|SEC|"b"/);
  });

  it("drops finished blockers", () => {
    const result = summarizeBlockers([link({ isOpen: false })], new Set(["a"]));
    expect(result.get("a")).toBeUndefined();
  });

  it("gives a task that is not open nothing", () => {
    const result = summarizeBlockers([link({})], new Set());
    expect(result.size).toBe(0);
  });

  it("keeps visible and hidden blockers apart for one task", () => {
    const result = summarizeBlockers(
      [
        link({ blockerId: "b1" }),
        link({ blockerId: "b2", visible: false }),
        link({ blockerId: "b3", visible: false }),
      ],
      new Set(["a"]),
    );
    expect(result.get("a")?.waitsOn.map((t) => t.id)).toEqual(["b1"]);
    expect(result.get("a")?.hiddenBlockers).toBe(2);
  });
});
