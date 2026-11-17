import { describe, expect, it } from "vite-plus/test";
import type { ConsentFacts } from "./consent";
import { ordinaryStatusMove, visibleStatusMove } from "./status-capability";

const outsider: ConsentFacts = {
  involved: false,
  bypass: false,
  feature: false,
  canUpdate: true,
  canDelete: false,
  canAssign: false,
};

describe("ordinaryStatusMove", () => {
  it("applies for an involved person or an admin", () => {
    expect(ordinaryStatusMove({ ...outsider, involved: true }, "to-do")).toBe(
      "apply",
    );
    expect(ordinaryStatusMove({ ...outsider, bypass: true }, "to-do")).toBe(
      "apply",
    );
  });

  it("requests for an outsider", () => {
    expect(ordinaryStatusMove(outsider, "in-progress")).toBe("request");
  });

  it("applies for an outsider on a feature, whose status is unused", () => {
    expect(ordinaryStatusMove({ ...outsider, feature: true }, "to-do")).toBe(
      "apply",
    );
  });

  it("treats leaving archived as the archive toggle, even for a feature", () => {
    expect(ordinaryStatusMove({ ...outsider, feature: true }, "archived")).toBe(
      "request",
    );
    expect(
      ordinaryStatusMove({ ...outsider, involved: true }, "archived"),
    ).toBe("apply");
  });

  it("denies without task:update, including an API key scope without it", () => {
    for (const facts of [
      { ...outsider, canUpdate: false },
      { ...outsider, canUpdate: false, involved: true },
      { ...outsider, canUpdate: false, bypass: true, feature: true },
    ])
      expect(ordinaryStatusMove(facts, "to-do")).toBe("deny");
  });
});

describe("visibleStatusMove", () => {
  const grants = (
    over: Partial<{ member: boolean; bypass: boolean }> = {},
  ) => ({
    member: true,
    bypass: false,
    can: () => true,
    ...over,
  });
  const task = {
    status: "to-do",
    createdBy: "creator",
    assigneeId: "assignee",
    feature: false,
  };

  it("applies for the creator and the assignee, requests for others", () => {
    expect(visibleStatusMove(grants(), "creator", task)).toBe("apply");
    expect(visibleStatusMove(grants(), "assignee", task)).toBe("apply");
    expect(visibleStatusMove(grants(), "other", task)).toBe("request");
    expect(visibleStatusMove(grants({ bypass: true }), "other", task)).toBe(
      "apply",
    );
  });

  it("does not count a creator who is no longer a member", () => {
    expect(visibleStatusMove(grants({ member: false }), "creator", task)).toBe(
      "request",
    );
  });

  it("denies when the grants lack task:update", () => {
    expect(
      visibleStatusMove(
        {
          ...grants(),
          can: (p) => !("task" in p && p.task?.includes("update")),
        },
        "creator",
        task,
      ),
    ).toBe("deny");
  });
});
