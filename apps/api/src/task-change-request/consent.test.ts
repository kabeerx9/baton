import { describe, expect, it } from "vite-plus/test";
import { type ConsentFacts, decideAnswer, decideConsent } from "./consent";

const outsider: ConsentFacts = {
  involved: false,
  bypass: false,
  feature: false,
  canUpdate: true,
  canDelete: false,
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
    expect(decideConsent("status", feature).kind).toBe("apply");
    expect(decideConsent("delete", feature).kind).toBe("request");
  });
});

describe("decideAnswer", () => {
  const involved = {
    isRequester: false,
    involved: true,
    bypass: false,
    canUpdate: true,
    canDelete: false,
  };
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
