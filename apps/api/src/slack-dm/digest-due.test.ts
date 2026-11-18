import { describe, expect, it } from "vite-plus/test";
import { digestDueDay } from "./digest-due";

const ten = { hour: 10, minute: 0 };
const due = (iso: string, zone: string, at = ten) =>
  digestDueDay(new Date(iso), zone, at);

describe("digestDueDay", () => {
  it("opens at 10:00 in Kolkata (+5:30) and closes an hour later", () => {
    expect(due("2026-11-18T04:30:00Z", "Asia/Kolkata")).toBe("2026-11-18");
    expect(due("2026-11-18T04:15:00Z", "Asia/Kolkata")).toBeNull();
    expect(due("2026-11-18T05:29:00Z", "Asia/Kolkata")).toBe("2026-11-18");
    expect(due("2026-11-18T05:30:00Z", "Asia/Kolkata")).toBeNull();
  });

  it("lands on a 15-minute tick in Kathmandu (+5:45)", () => {
    expect(due("2026-11-18T04:15:00Z", "Asia/Kathmandu")).toBe("2026-11-18");
    expect(due("2026-11-18T04:00:00Z", "Asia/Kathmandu")).toBeNull();
  });

  it("follows DST in New York", () => {
    expect(due("2026-03-06T15:00:00Z", "America/New_York")).toBe("2026-03-06");
    expect(due("2026-03-09T14:00:00Z", "America/New_York")).toBe("2026-03-09");
    expect(due("2026-03-09T15:00:00Z", "America/New_York")).toBeNull();
  });

  it("decides the weekend by the local day", () => {
    // Saturday in Auckland, Friday in UTC.
    expect(due("2026-11-20T21:00:00Z", "Pacific/Auckland")).toBeNull();
    // Monday in Auckland, Sunday in UTC.
    expect(due("2026-11-22T21:00:00Z", "Pacific/Auckland")).toBe("2026-11-23");
  });

  it("sends after a DST gap that skips the send time", () => {
    // Cairo skips 00:00-00:59 on 2026-04-24; 22:00Z is 01:00 Friday.
    expect(
      due("2026-04-23T22:00:00Z", "Africa/Cairo", { hour: 0, minute: 30 }),
    ).toBe("2026-04-24");
  });

  it("gives the same day twice in a DST overlap", () => {
    const at = { hour: 23, minute: 15 };
    expect(due("2026-10-29T20:15:00Z", "Africa/Cairo", at)).toBe("2026-10-29");
    expect(due("2026-10-29T21:15:00Z", "Africa/Cairo", at)).toBe("2026-10-29");
  });
});
