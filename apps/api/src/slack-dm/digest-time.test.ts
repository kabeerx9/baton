import { describe, expect, it } from "vite-plus/test";
import { parseDigestTime } from "./digest-time";

describe("parseDigestTime", () => {
  it.each([
    ["10:00", { hour: 10, minute: 0 }],
    ["09:30", { hour: 9, minute: 30 }],
    ["23:59", { hour: 23, minute: 59 }],
  ])("parses %s", (raw, expected) => {
    expect(parseDigestTime(raw)).toEqual(expected);
  });

  it.each(["9:30", "24:00", "10:60", "", undefined])("rejects %j", (raw) => {
    expect(parseDigestTime(raw)).toBeNull();
  });
});
