import { describe, expect, it } from "vite-plus/test";
import { featureHeadline } from "./feature-headline";
import { summarizeFeature } from "./feature-status";
import { blockerOf, makeFeature, makeTask } from "./make-task";
import { AISHA, KABEER, MARIA } from "./people";
import { SCENARIOS } from "./scenarios";

const summaryOf = (id: string) => {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return summarizeFeature(s.feature, s);
};

describe("summarizeFeature", () => {
  it("reads the big feature: moving, 2 blocked, 1 asked, 3 owners", () => {
    const s = summaryOf("big");
    expect(s.status).toEqual({ kind: "moving" });
    expect(s.counts).toEqual({ todo: 4, doing: 3, review: 2, done: 3 });
    expect(s.held.map((h) => [h.kind, h.task.key])).toEqual([
      ["asked", "ENG-9"],
      ["blocked", "WEB-44"],
      ["blocked", "WEB-45"],
    ]);
    expect(s.owners.map((o) => o.person?.name)).toEqual([
      "Kabeer",
      "Aisha",
      "Rohan",
    ]);
  });

  it("splits blockers inside the feature from blockers in another one", () => {
    const blocked = summaryOf("big").held.filter((h) => h.kind === "blocked");
    expect(blocked[0]?.inside.map((b) => b.key)).toEqual(["API-33"]);
    expect(blocked[0]?.outside).toEqual([]);
    expect(blocked[1]?.inside).toEqual([]);
    expect(blocked[1]?.outside.map((b) => b.key)).toEqual(["APP-17"]);
  });

  it("derives done, not started and moving for the other scenarios", () => {
    expect(summaryOf("done").status.kind).toBe("done");
    expect(summaryOf("fresh").status.kind).toBe("notStarted");
    expect(summaryOf("small").status.kind).toBe("moving");
    expect(summaryOf("linked").waitsOn.map((x) => x.key)).toEqual(["T-41"]);
    expect(summaryOf("linked").blocks).toHaveLength(2);
  });

  it("is stuck when every open task is blocked, asking when one is asked", () => {
    const first = makeTask({
      key: "API-1",
      title: "First",
      status: "doing",
      owner: AISHA,
    });
    const blockedTask = (key: string) =>
      makeTask({
        key,
        title: key,
        status: "todo",
        owner: KABEER,
        waitsOn: [blockerOf(first, AISHA)],
      });
    const stuck = makeFeature({
      key: "T-1",
      title: "x",
      summary: "",
      owner: null,
      subtasks: [blockedTask("WEB-1"), blockedTask("WEB-2")],
    });
    expect(summarizeFeature(stuck, { waitsOn: [], blocks: [] }).status).toEqual(
      { kind: "stuck" },
    );
    const asking = makeFeature({
      key: "T-2",
      title: "x",
      summary: "",
      owner: null,
      subtasks: [
        blockedTask("WEB-1"),
        makeTask({
          key: "WEB-3",
          title: "asked",
          status: "doing",
          owner: KABEER,
          request: {
            id: "r",
            kind: "status",
            targetStatus: "done",
            requestedBy: MARIA.id,
            channel: "web",
            expiresAt: "2026-11-20T00:00:00.000Z",
          },
        }),
      ],
    });
    expect(
      summarizeFeature(asking, { waitsOn: [], blocks: [] }).status,
    ).toEqual({ kind: "asking" });
  });

  it("treats a feature with no tasks as empty, the safe state", () => {
    const empty = makeFeature({
      key: "T-3",
      title: "x",
      summary: "",
      owner: null,
      subtasks: [],
    });
    expect(
      summarizeFeature(empty, { waitsOn: [], blocks: [] }).status.kind,
    ).toBe("empty");
  });

  it("ignores a done feature link when it lists what waits", () => {
    const s = summaryOf("linked");
    expect(s.waitsOn.every((x) => x.status !== "done")).toBe(true);
  });
});

describe("featureHeadline", () => {
  it("says the counts and the trouble", () => {
    expect(featureHeadline(summaryOf("big"))).toBe(
      "3 of 12 tasks done. 2 blocked, 1 waiting for an answer.",
    );
    expect(featureHeadline(summaryOf("small"))).toBe(
      "0 of 2 tasks done. 2 in progress.",
    );
    expect(featureHeadline(summaryOf("done"))).toBe("All 5 tasks are done.");
    expect(featureHeadline(summaryOf("fresh"))).toBe(
      "Not started. 4 tasks are waiting to begin.",
    );
  });

  it("names the feature that holds this one up", () => {
    expect(featureHeadline(summaryOf("linked"))).toBe(
      "1 of 4 tasks done. 2 in progress. It cannot finish until T-41 is done.",
    );
  });
});
