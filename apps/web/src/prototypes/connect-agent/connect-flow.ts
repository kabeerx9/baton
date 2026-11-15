// The "did my agent connect?" lifecycle of the steps variant. One union, one reducer.
export type ConnectFlow =
  | { status: "waiting" }
  | { status: "connecting" }
  | { status: "connected" };

export type ConnectAction =
  | { type: "reset" }
  | { type: "sign-in-seen" }
  | { type: "list-updated" };

export function connectFlowReducer(
  state: ConnectFlow,
  action: ConnectAction,
): ConnectFlow {
  switch (action.type) {
    case "reset":
      return { status: "waiting" };
    case "sign-in-seen":
      return state.status === "waiting" ? { status: "connecting" } : state;
    case "list-updated":
      return state.status === "connecting" ? { status: "connected" } : state;
    default:
      // An unknown action keeps the safe, inactive state.
      return state;
  }
}
