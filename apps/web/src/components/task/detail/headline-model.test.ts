import { describe, expect, it } from "vite-plus/test";
import { deriveHeadline } from "./headline-model";

const base = {
  bar: "ready" as const,
  done: false,
  openBlockers: [],
  pendingRequest: false,
  released: 0,
  owner: null,
};

describe("deriveHeadline", () => {
  it("is unknown first", () => {
    expect(deriveHeadline({ ...base, bar: "unknown", done: true }).kind).toBe(
      "unknown",
    );
  });
  it("names released tasks when done", () => {
    expect(deriveHeadline({ ...base, done: true, released: 2 })).toEqual({
      kind: "done",
      released: 2,
    });
  });
  it("puts a pending request before waiting", () => {
    expect(
      deriveHeadline({
        ...base,
        pendingRequest: true,
        openBlockers: [{ key: "A-1" }],
      }).kind,
    ).toBe("request");
  });
  it("lists blockers", () => {
    expect(
      deriveHeadline({
        ...base,
        openBlockers: [{ key: "A-1" }, { key: "B-2" }],
      }),
    ).toEqual({
      kind: "waiting",
      count: 2,
      keys: "A-1, B-2",
    });
  });
});
