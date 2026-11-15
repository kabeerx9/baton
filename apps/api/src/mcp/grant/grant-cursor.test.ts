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

  const cursorOf = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

  it.each([
    ["a NUL id", ["2026-11-15T10:00:00.000Z", "\u0000"]],
    ["an id with a NUL inside", ["2026-11-15T10:00:00.000Z", "g\u0000x"]],
    ["an over-long id", ["2026-11-15T10:00:00.000Z", "g".repeat(65)]],
    ["an id with spaces", ["2026-11-15T10:00:00.000Z", "g 1"]],
  ])("rejects %s", (_, value) => {
    expect(decodeGrantCursor(cursorOf(value))).toBeNull();
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
