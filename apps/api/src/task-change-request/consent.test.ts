import { describe, expect, it } from "vite-plus/test";
import { type ConsentFacts, decideAnswer, decideConsent } from "./consent";

const outsider: ConsentFacts = {
  involved: false,
  assignee: false,
  bypass: false,
  feature: false,
  canUpdate: true,
  canUpdateAssigned: true,
  canDelete: false,
  canAssign: true,
};

describe("decideConsent", () => {
  it("applies an involved person's or admin's changes", () => {
    for (const facts of [
      { ...outsider, involved: true },
      { ...outsider, bypass: true },
    ]) {
      expect(decideConsent("status", facts).kind).toBe("apply");
      expect(decideConsent("assign", facts).kind).toBe("apply");
      expect(decideConsent("edit", facts)).toEqual({
        kind: "apply",
        notifyInvolved: false,
      });
    }
  });

  it("turns an outsider's status change and delete into requests", () => {
    expect(decideConsent("status", outsider).kind).toBe("request");
    expect(decideConsent("delete", outsider).kind).toBe("request");
    expect(decideConsent("delete", { ...outsider, canDelete: true }).kind).toBe(
      "request",
    );
  });

  it("needs task:update to ask for a delete, as accept re-checks", () => {
    expect(
      decideConsent("delete", {
        ...outsider,
        canUpdate: false,
        canDelete: true,
      }).kind,
    ).toBe("deny");
  });

  it("needs task:assign before involvement for any reassignment", () => {
    for (const facts of [
      { ...outsider, involved: true, canAssign: false },
      { ...outsider, bypass: true, canAssign: false },
    ])
      expect(decideConsent("assign", facts)).toMatchObject({
        kind: "deny",
        message: "Missing task:assign permission",
      });
  });

  it("lets an outsider edit fields but notifies the involved people", () => {
    expect(decideConsent("edit", outsider)).toEqual({
      kind: "apply",
      notifyInvolved: true,
    });
  });

  it("refuses outsider reassignment", () => {
    expect(decideConsent("assign", outsider).kind).toBe("deny");
  });

  it("never grants a permission the role lacks", () => {
    const viewer = { ...outsider, involved: true, canUpdate: false };
    expect(decideConsent("status", viewer).kind).toBe("deny");
    expect(decideConsent("delete", viewer).kind).toBe("deny");
    expect(
      decideConsent("delete", { ...outsider, bypass: true, canDelete: false })
        .kind,
    ).toBe("deny");
    expect(
      decideConsent("status", { ...outsider, canUpdate: false }).kind,
    ).toBe("deny");
  });

  it("applies a feature's own status directly but still guards its deletion", () => {
    const feature = { ...outsider, feature: true };
    const move = { from: "to-do", to: "in-progress" };
    expect(decideConsent("status", feature, move).kind).toBe("apply");
    expect(decideConsent("delete", feature).kind).toBe("request");
  });

  it("turns an outsider's archive or unarchive of a feature into a request", () => {
    const feature = { ...outsider, feature: true };
    for (const move of [
      { from: "to-do", to: "archived" },
      { from: "archived", to: "in-progress" },
    ])
      expect(decideConsent("status", feature, move).kind).toBe("request");
    // Without the move, the feature exception never applies.
    expect(decideConsent("status", feature).kind).toBe("request");
  });
});

describe("decideConsent for task:update_assigned only (viewer)", () => {
  const viewer: ConsentFacts = {
    ...outsider,
    canUpdate: false,
    canAssign: false,
  };
  const own = { ...viewer, involved: true, assignee: true };

  it("applies status and edits on a task assigned to the caller", () => {
    expect(decideConsent("status", own)).toEqual({
      kind: "apply",
      notifyInvolved: false,
    });
    expect(decideConsent("edit", own)).toEqual({
      kind: "apply",
      notifyInvolved: false,
    });
    // Archive is a status too, and the feature rule is the task's rule.
    expect(
      decideConsent(
        "status",
        { ...own, feature: true },
        {
          from: "to-do",
          to: "archived",
        },
      ).kind,
    ).toBe("apply");
  });

  it("refuses status and edits on any other task, never a request", () => {
    for (const facts of [
      viewer,
      // The creator who is not the assignee is involved but not assigned.
      { ...viewer, involved: true },
      // A feature the caller does not own does not take the feature rule.
      { ...viewer, feature: true },
      // An admin role cannot lend bypass to a narrowed key or role.
      { ...viewer, bypass: true },
    ]) {
      for (const change of ["status", "edit"] as const)
        expect(
          decideConsent(change, facts, { from: "to-do", to: "done" }),
        ).toEqual({
          kind: "deny",
          status: 403,
          message: "You can only change tasks assigned to you.",
        });
    }
  });

  it("never deletes or assigns, even on the caller's own task", () => {
    expect(decideConsent("delete", own).kind).toBe("deny");
    expect(decideConsent("assign", own).kind).toBe("deny");
    expect(decideConsent("delete", viewer).kind).toBe("deny");
  });

  it("names task:update when update_assigned is missing too", () => {
    expect(
      decideConsent("edit", { ...viewer, canUpdateAssigned: false }),
    ).toMatchObject({
      kind: "deny",
      message: "Missing task:update permission",
    });
  });
});

describe("decideAnswer", () => {
  const involved = {
    isRequester: false,
    involved: true,
    assignee: false,
    bypass: false,
    canUpdate: true,
    canUpdateAssigned: true,
    canDelete: false,
  };
  it("lets a viewer answer status requests only on a task assigned to them", () => {
    const viewer = { ...involved, canUpdate: false };
    expect(decideAnswer("status", { ...viewer, assignee: true }).ok).toBe(true);
    expect(decideAnswer("status", viewer).ok).toBe(false);
    expect(decideAnswer("delete", { ...viewer, assignee: true }).ok).toBe(
      false,
    );
  });
  it("needs involvement or bypass and the action permission", () => {
    expect(decideAnswer("status", involved).ok).toBe(true);
    expect(decideAnswer("delete", involved).ok).toBe(false);
    expect(decideAnswer("delete", { ...involved, canDelete: true }).ok).toBe(
      true,
    );
    expect(decideAnswer("status", { ...involved, involved: false }).ok).toBe(
      false,
    );
    expect(
      decideAnswer("status", { ...involved, involved: false, bypass: true }).ok,
    ).toBe(true);
  });
  it("refuses the requester", () => {
    expect(
      decideAnswer("status", { ...involved, bypass: true, isRequester: true })
        .ok,
    ).toBe(false);
  });
});
