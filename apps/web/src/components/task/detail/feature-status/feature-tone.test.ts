import { describe, expect, it } from "vite-plus/test";
import { summarizeFeature } from "./feature-status";
import { featureTone } from "./feature-tone";
import { blockerOf, feature, task } from "./test-fixtures";

const none = {
  waitsOn: [],
  blocks: [],
  boardTasks: [],
  memberName: () => null,
};
const tone = (...tasks: ReturnType<typeof task>[]) =>
  featureTone(summarizeFeature(feature("T-1", tasks), none));

describe("featureTone", () => {
  it("picks the tone from the status", () => {
    expect(tone(task({ key: "A-1", status: "doing" }))).toBe("blue");
    expect(tone(task({ key: "A-1", status: "done" }))).toBe("emerald");
    expect(tone(task({ key: "A-1" }))).toBe("neutral");
    const a = task({ key: "A-1", status: "doing" });
    expect(tone(a, task({ key: "A-2", waitsOn: [blockerOf(a)] }))).toBe("blue");
    expect(tone(task({ key: "A-2", hiddenBlockers: 1 }))).toBe("amber");
  });
});
