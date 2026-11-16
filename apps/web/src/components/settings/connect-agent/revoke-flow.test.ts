import { describe, expect, it } from "vite-plus/test";
import {
  IDLE,
  type RevokeAction,
  type RevokeFlow,
  revokeReducer,
} from "./revoke-flow";

const run = (state: RevokeFlow, ...actions: RevokeAction[]) =>
  actions.reduce(revokeReducer, state);

describe("revokeReducer", () => {
  it("confirms, revokes, then returns to idle", () => {
    expect(
      run(
        IDLE,
        { type: "ask", grantId: "g1" },
        { type: "started" },
        { type: "succeeded" },
      ),
    ).toEqual(IDLE);
  });

  it("keeps the grant after a failure so the person can retry", () => {
    const failed = run(
      IDLE,
      { type: "ask", grantId: "g1" },
      { type: "started" },
      { type: "failed" },
    );
    expect(failed).toEqual({ status: "failed", grantId: "g1" });
    expect(run(failed, { type: "started" })).toEqual({
      status: "revoking",
      grantId: "g1",
    });
  });

  it("cannot be cancelled or redirected while a revoke is in flight", () => {
    const revoking = run(
      IDLE,
      { type: "ask", grantId: "g1" },
      { type: "started" },
    );
    expect(run(revoking, { type: "cancel" })).toBe(revoking);
    expect(run(revoking, { type: "ask", grantId: "g2" })).toBe(revoking);
  });

  it("does not start a revoke from idle", () => {
    expect(run(IDLE, { type: "started" })).toBe(IDLE);
    expect(run(IDLE, { type: "succeeded" })).toBe(IDLE);
  });

  it("keeps the state on an unknown action", () => {
    const confirming = run(IDLE, { type: "ask", grantId: "g1" });
    expect(
      revokeReducer(confirming, { type: "bogus" } as unknown as RevokeAction),
    ).toBe(confirming);
  });
});
