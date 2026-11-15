import { describe, expect, it } from "vite-plus/test";
import { makeConnectedGrant } from "./fixtures";
import {
  type GrantsAction,
  type GrantsState,
  grantsReducer,
  initialState,
  pendingGrant,
} from "./grants-state";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const run = (state: GrantsState, ...actions: GrantsAction[]) =>
  actions.reduce(grantsReducer, state);

describe("initialState", () => {
  it("maps scenarios to lifecycle states", () => {
    expect(initialState("loading", NOW).list.status).toBe("loading");
    expect(initialState("error", NOW).list.status).toBe("error");
    const empty = initialState("empty", NOW).list;
    expect(empty.status === "ready" && empty.grants).toEqual([]);
    const normal = initialState("normal", NOW).list;
    expect(normal.status === "ready" && normal.grants).toHaveLength(4);
  });
});

describe("revoke flow", () => {
  const start = initialState("normal", NOW);

  it("confirms, revokes, and removes the grant", () => {
    const state = run(
      start,
      { type: "ask-revoke", grantId: "grant_cx02" },
      { type: "revoke-started" },
      { type: "revoke-succeeded", grantId: "grant_cx02" },
    );
    expect(state.revoke.status).toBe("idle");
    expect(
      state.list.status === "ready" && state.list.grants.map((g) => g.id),
    ).not.toContain("grant_cx02");
  });

  it("keeps the grant and allows a retry when revoke fails", () => {
    const failed = run(
      start,
      { type: "ask-revoke", grantId: "grant_cx02" },
      { type: "revoke-started" },
      { type: "revoke-failed" },
    );
    expect(failed.revoke).toEqual({ status: "failed", grantId: "grant_cx02" });
    expect(pendingGrant(failed)?.id).toBe("grant_cx02");
    expect(
      grantsReducer(failed, { type: "revoke-started" }).revoke.status,
    ).toBe("revoking");
  });

  it("cannot be cancelled or re-asked while revoking", () => {
    const revoking = run(
      start,
      { type: "ask-revoke", grantId: "grant_cx02" },
      { type: "revoke-started" },
    );
    expect(grantsReducer(revoking, { type: "cancel-revoke" })).toBe(revoking);
    expect(
      grantsReducer(revoking, { type: "ask-revoke", grantId: "grant_cc01" }),
    ).toBe(revoking);
  });

  it("ignores revoke actions outside the ready list", () => {
    const loading = initialState("loading", NOW);
    expect(grantsReducer(loading, { type: "ask-revoke", grantId: "x" })).toBe(
      loading,
    );
  });
});

describe("list lifecycle", () => {
  it("retries from error through loading", () => {
    const state = run(initialState("error", NOW), { type: "reload" });
    expect(state.list.status).toBe("loading");
    expect(grantsReducer(state, { type: "load-failed" }).list.status).toBe(
      "error",
    );
  });

  it("adds a connected agent at the top of a ready list only", () => {
    const grant = makeConnectedGrant("claude-code", NOW);
    const ready = grantsReducer(initialState("empty", NOW), {
      type: "connected",
      grant,
    });
    expect(ready.list.status === "ready" && ready.list.grants[0]).toEqual(
      grant,
    );
    const loading = initialState("loading", NOW);
    expect(grantsReducer(loading, { type: "connected", grant })).toBe(loading);
  });

  it("leaves state alone for an unknown action", () => {
    const state = initialState("normal", NOW);
    expect(
      grantsReducer(state, { type: "nope" } as unknown as GrantsAction),
    ).toBe(state);
  });
});
