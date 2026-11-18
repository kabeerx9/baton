import { describe, expect, it } from "vite-plus/test";
import { isTimeZone } from "./is-time-zone";

describe("isTimeZone", () => {
  it.each([
    "Asia/Kolkata",
    "Asia/Calcutta",
    "Asia/Kathmandu",
    "America/Argentina/Buenos_Aires",
    "America/Port-au-Prince",
    "Etc/GMT+5",
    "UTC",
  ])("accepts %s", (value) => {
    expect(isTimeZone(value)).toBe(true);
  });

  it.each([
    "IST",
    "EST",
    "PST",
    "GMT",
    "EST5EDT",
    "+05:30",
    "GMT+5",
    "utc",
    "asia/kolkata",
    "Mars/Phobos",
    "",
    "Asia/Kolkata ",
    `Asia/${"K".repeat(60)}`,
    null,
    123,
  ])("rejects %j", (value) => {
    expect(isTimeZone(value)).toBe(false);
  });

  it("uses a 65-character value in the reject table", () => {
    expect(`Asia/${"K".repeat(60)}`).toHaveLength(65);
  });

  it("accepts every zone this runtime lists", () => {
    for (const zone of Intl.supportedValuesOf("timeZone")) {
      expect(isTimeZone(zone)).toBe(true);
    }
  });
});
