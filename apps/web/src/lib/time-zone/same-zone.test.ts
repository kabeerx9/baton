import { describe, expect, it } from "vite-plus/test";
import { sameZone } from "./same-zone";

const NOW = new Date("2026-11-18T10:00:00Z");

describe("sameZone", () => {
  it("treats Calcutta and Kolkata as one", () => {
    expect(sameZone("Asia/Calcutta", "Asia/Kolkata", NOW)).toBe(true);
  });

  it("ignores a move that keeps the clock (Berlin to Paris)", () => {
    expect(sameZone("Europe/Berlin", "Europe/Paris", NOW)).toBe(true);
  });

  it("tells New York from Bogota, which differ in summer", () => {
    expect(sameZone("America/New_York", "America/Bogota", NOW)).toBe(false);
  });

  it("tells Kolkata from Kathmandu", () => {
    expect(sameZone("Asia/Kolkata", "Asia/Kathmandu", NOW)).toBe(false);
  });

  it("gives true for a zone the browser does not know", () => {
    expect(sameZone("Mars/Phobos", "Asia/Kolkata", NOW)).toBe(true);
  });
});
