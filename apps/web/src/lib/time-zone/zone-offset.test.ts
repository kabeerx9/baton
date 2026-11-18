import { describe, expect, it } from "vite-plus/test";
import { formatOffset, zoneOffsetMinutes } from "./zone-offset";

const WINTER = new Date("2026-01-15T12:00:00Z");
const SUMMER = new Date("2026-07-15T12:00:00Z");

describe("zoneOffsetMinutes", () => {
  it("reads whole-hour, half-hour and 45-minute zones", () => {
    expect(zoneOffsetMinutes("Asia/Kolkata", WINTER)).toBe(330);
    expect(zoneOffsetMinutes("Asia/Kathmandu", WINTER)).toBe(345);
    expect(zoneOffsetMinutes("America/Los_Angeles", WINTER)).toBe(-480);
  });

  it("follows daylight saving", () => {
    expect(zoneOffsetMinutes("America/Los_Angeles", SUMMER)).toBe(-420);
    expect(zoneOffsetMinutes("Europe/London", SUMMER)).toBe(60);
  });

  it("gives 0 for UTC", () => {
    expect(zoneOffsetMinutes("UTC", WINTER)).toBe(0);
  });
});

describe("formatOffset", () => {
  it("formats", () => {
    expect(formatOffset(330)).toBe("GMT+5:30");
    expect(formatOffset(-480)).toBe("GMT-8");
    expect(formatOffset(0)).toBe("GMT+0");
    expect(formatOffset(345)).toBe("GMT+5:45");
  });
});
