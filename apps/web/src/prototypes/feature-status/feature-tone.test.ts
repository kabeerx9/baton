import { describe, expect, it } from "vite-plus/test";
import { featureTone } from "./feature-tone";
import { summarizeFeature } from "./feature-status";
import { SCENARIOS } from "./scenarios";

const summaryOf = (id: string) => {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return summarizeFeature(s.feature, s);
};

describe("featureTone", () => {
  it("picks the tone from the status", () => {
    expect(featureTone(summaryOf("big"))).toBe("blue");
    expect(featureTone(summaryOf("done"))).toBe("emerald");
    expect(featureTone(summaryOf("fresh"))).toBe("neutral");
    expect(featureTone(summaryOf("linked"))).toBe("amber");
  });
});
