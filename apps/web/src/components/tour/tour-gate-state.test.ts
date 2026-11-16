import { describe, expect, it } from "vite-plus/test";
import { gateReducer, shouldHostTour } from "./tour-gate-state";

describe("shouldHostTour", () => {
  const base = {
    completed: false,
    hasRealWorkspace: true,
    pathname: "/dashboard/workspace/w1/board",
  };

  it("runs for a user who owes the tour inside the app", () => {
    expect(shouldHostTour(base)).toBe(true);
  });

  it.each([
    ["the status is unknown", { completed: undefined }],
    ["the tour is done", { completed: true }],
    ["there is no real workspace yet", { hasRealWorkspace: false }],
    ["onboarding is open", { pathname: "/onboarding" }],
    ["an invite is open", { pathname: "/dashboard/invitations" }],
  ])("waits when %s", (_name, override) => {
    expect(shouldHostTour({ ...base, ...override })).toBe(false);
  });
});

describe("gateReducer", () => {
  it("starts once, and a stale answer cannot restart a closed tour", () => {
    let state = gateReducer(
      { status: "idle" },
      { type: "OWED", updatedAt: 100 },
    );
    expect(state.status).toBe("hosting");
    state = gateReducer(state, { type: "CLOSED", at: 200 });
    expect(gateReducer(state, { type: "OWED", updatedAt: 150 })).toBe(state);
  });

  it("starts again after a replay refreshes the status", () => {
    const closed = { status: "closed", at: 200 } as const;
    expect(gateReducer(closed, { type: "OWED", updatedAt: 300 }).status).toBe(
      "hosting",
    );
  });
});
