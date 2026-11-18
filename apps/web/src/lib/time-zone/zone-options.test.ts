import { describe, expect, it } from "vite-plus/test";
import {
  displayZone,
  matchesZone,
  selectedValue,
  zoneOptions,
} from "./zone-options";

const NOW = new Date("2026-11-18T10:00:00Z");
const find = (zone: string) =>
  zoneOptions(null, NOW).find((option) => option.value === zone);

describe("zoneOptions", () => {
  it("has UTC and sorts by offset then name", () => {
    const options = zoneOptions(null, NOW);
    expect(options.some((o) => o.value === "UTC")).toBe(true);
    for (let i = 1; i < options.length; i += 1) {
      const [a, b] = [options[i - 1]!, options[i]!];
      expect(
        a.offset < b.offset || (a.offset === b.offset && a.value <= b.value),
      ).toBe(true);
    }
  });

  it("labels with offset and spaces for underscores", () => {
    const option = zoneOptions(null, NOW).find(
      (o) => o.value === "America/New_York",
    );
    expect(option?.label).toBe("(GMT-5) America/New York");
  });

  it("appends a zone the browser does not resolve", () => {
    const options = zoneOptions("Mars/Phobos", NOW);
    expect(options.at(-1)?.value).toBe("Mars/Phobos");
  });

  it("does not append a zone an entry already stands for", () => {
    const count = zoneOptions(null, NOW).length;
    expect(zoneOptions("Asia/Kolkata", NOW).length).toBe(count);
  });
});

describe("selectedValue", () => {
  const options = zoneOptions(null, NOW);

  it("selects an exact entry", () => {
    expect(selectedValue(options, "Europe/London")).toBe("Europe/London");
  });

  it("selects the entry the browser lists for an alias", () => {
    const picked = selectedValue(options, "Asia/Kolkata");
    expect(["Asia/Kolkata", "Asia/Calcutta"]).toContain(picked);
  });

  it("gives null for no zone", () => {
    expect(selectedValue(options, null)).toBeNull();
  });
});

describe("matchesZone", () => {
  const kolkata = find("Asia/Calcutta") ?? find("Asia/Kolkata")!;

  it("finds a zone by the modern and the legacy name", () => {
    expect(matchesZone(kolkata, "kolkata")).toBe(true);
    expect(matchesZone(kolkata, "calcutta")).toBe(true);
  });

  it("finds by the stored value, by offset and by city", () => {
    expect(matchesZone(find("America/New_York")!, "new_york")).toBe(true);
    expect(matchesZone(find("America/New_York")!, "gmt-5")).toBe(true);
    expect(matchesZone(find("America/New_York")!, "new york")).toBe(true);
  });

  it("rejects a non-match", () => {
    expect(matchesZone(kolkata, "tokyo")).toBe(false);
  });
});

describe("displayZone", () => {
  it("shows modern names", () => {
    expect(displayZone("Asia/Calcutta")).toBe("Asia/Kolkata");
    expect(displayZone("America/Los_Angeles")).toBe("America/Los Angeles");
  });
});
