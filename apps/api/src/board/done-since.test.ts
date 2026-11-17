import { describe, expect, it } from "vite-plus/test";
import { DONE_WINDOW_DAYS, resolveDoneSince } from "./done-since";

const NOW = new Date("2030-01-20T12:00:00.000Z");

describe("resolveDoneSince", () => {
  it("defaults to now minus the window", () => {
    expect(resolveDoneSince(undefined, NOW).toISOString()).toBe(
      new Date(
        NOW.getTime() - DONE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
    );
  });

  it("keeps a past value with its offset", () => {
    expect(
      resolveDoneSince("2030-01-06T00:00:00+05:30", NOW).toISOString(),
    ).toBe("2030-01-05T18:30:00.000Z");
  });

  it("clamps a future value to now", () => {
    expect(resolveDoneSince("2031-01-01T00:00:00Z", NOW)).toEqual(NOW);
  });

  it("returns more history for an old value", () => {
    expect(resolveDoneSince("2000-01-01T00:00:00Z", NOW).toISOString()).toBe(
      "2000-01-01T00:00:00.000Z",
    );
  });
});
