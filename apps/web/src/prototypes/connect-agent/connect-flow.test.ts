import { describe, expect, it } from "vite-plus/test";
import {
  type ConnectAction,
  type ConnectFlow,
  connectFlowReducer,
} from "./connect-flow";

const run = (state: ConnectFlow, ...actions: ConnectAction[]) =>
  actions.reduce(connectFlowReducer, state);

describe("connectFlowReducer", () => {
  it("goes waiting, connecting, connected", () => {
    expect(
      run(
        { status: "waiting" },
        { type: "sign-in-seen" },
        { type: "list-updated" },
      ),
    ).toEqual({ status: "connected" });
  });

  it("does not skip connecting", () => {
    const waiting: ConnectFlow = { status: "waiting" };
    expect(connectFlowReducer(waiting, { type: "list-updated" })).toBe(waiting);
  });

  it("resets to waiting from any state", () => {
    expect(run({ status: "connected" }, { type: "reset" })).toEqual({
      status: "waiting",
    });
  });

  it("keeps state for an unknown action", () => {
    const state: ConnectFlow = { status: "connected" };
    expect(
      connectFlowReducer(state, { type: "x" } as unknown as ConnectAction),
    ).toBe(state);
  });
});
