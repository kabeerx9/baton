import type { StatusBarState } from "./status-bar/status-bar-model";

/** The one sentence under the title, as data. The component turns it into copy. */
export type Headline =
  | { kind: "unknown" }
  | { kind: "done"; released: number }
  | { kind: "request" }
  | { kind: "waiting"; count: number; keys: string }
  | { kind: "ready"; owner: string | null; started: boolean };

export function deriveHeadline({
  bar,
  done,
  openBlockers,
  pendingRequest,
  released,
  owner,
}: {
  bar: StatusBarState["kind"];
  done: boolean;
  openBlockers: { key: string }[];
  pendingRequest: boolean;
  /** Tasks that can continue now that this one is done. */
  released: number;
  owner: string | null;
}): Headline {
  if (bar === "unknown") return { kind: "unknown" };
  if (done) return { kind: "done", released };
  if (pendingRequest) return { kind: "request" };
  if (openBlockers.length > 0)
    return {
      kind: "waiting",
      count: openBlockers.length,
      keys: openBlockers.map((b) => b.key).join(", "),
    };
  return { kind: "ready", owner, started: false };
}
