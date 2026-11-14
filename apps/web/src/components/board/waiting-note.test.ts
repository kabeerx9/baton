import { describe, expect, it } from "vite-plus/test";
import { blocker } from "./test-fixtures";
import { waitingNote } from "./waiting-note";

describe("waitingNote", () => {
  it("is null when nothing blocks the item", () => {
    expect(waitingNote({ waitsOn: [], hiddenBlockers: 0 })).toBeNull();
  });

  it("names a single task's blocker with its owner", () => {
    expect(
      waitingNote({ waitsOn: [blocker("T-12", "Sam")], hiddenBlockers: 0 }),
    ).toEqual({
      visible: ["T-12 · Sam"],
      hidden: 0,
    });
  });

  it("leaves out the owner when there is none", () => {
    expect(
      waitingNote({ waitsOn: [blocker("T-12")], hiddenBlockers: 0 })?.visible,
    ).toEqual(["T-12"]);
  });

  it("reports hidden blockers alone", () => {
    expect(waitingNote({ waitsOn: [], hiddenBlockers: 2 })).toEqual({
      visible: [],
      hidden: 2,
    });
  });
});
