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
  ])("accepts %s", (zone) => {
    expect(isTimeZone(zone)).toBe(true);
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
    `Asia/${"A".repeat(60)}`,
    null,
    123,
  ])("rejects %j", (zone) => {
    expect(isTimeZone(zone)).toBe(false);
  });

  it("accepts every name the browser lists", () => {
    for (const zone of Intl.supportedValuesOf("timeZone")) {
      expect(isTimeZone(zone), zone).toBe(true);
    }
  });
});
