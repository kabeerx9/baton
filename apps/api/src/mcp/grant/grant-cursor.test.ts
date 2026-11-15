import { describe, expect, it } from "vite-plus/test";
import { decodeGrantCursor, encodeGrantCursor } from "./grant-cursor";

describe("grant cursor", () => {
  it("round-trips a position", () => {
    const cursor = {
      createdAt: new Date("2026-11-15T10:00:00.123Z"),
      id: "g1",
    };
    expect(decodeGrantCursor(encodeGrantCursor(cursor))).toEqual(cursor);
  });

  it.each([
    "",
    "not-base64-json",
    btoa("[1,2]"),
    btoa('["nope","g1"]'),
    btoa('["2026-11-15T10:00:00Z",""]'),
  ])("rejects %j", (value) => {
    expect(decodeGrantCursor(value)).toBeNull();
  });
});
