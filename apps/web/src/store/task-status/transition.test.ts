import { describe, expect, it } from "vite-plus/test";
import {
  IDLE,
  isStatusLocked,
  moveOf,
  overlayTarget,
  shownStatus,
  transition,
} from "./transition";
import type { Entry, Event, Target } from "./types";

const A: Target = { status: "in-progress", isFinal: false };
const B: Target = { status: "done", isFinal: true };
const C: Target = { status: "in-review", isFinal: false };

const confirming: Entry = { kind: "confirming", target: A };
const asking: Entry = { kind: "asking", target: A };
const sending: Entry = { kind: "sending", inFlight: A, latest: A };
const queued: Entry = { kind: "sending", inFlight: A, latest: B };
const confirmed: Entry = { kind: "confirmed", target: A, generation: 4 };
const uncertain: Entry = { kind: "uncertain", since: 100 };
const unknownKind = { kind: "from-the-future" } as unknown as Entry;

const ENTRIES: Record<string, Entry> = {
  idle: IDLE,
  confirming,
  asking,
  sending,
  queued,
  confirmed,
  uncertain,
  unknownKind,
};

const chosen = (target: Target, move: "apply" | "request" | "deny"): Event => ({
  type: "chosen",
  target,
  move,
});

/** [entry, event, next entry, target to send]. Every state x event is a row. */
const TABLE: [string, string, Event, Entry, Target?][] = [
  // chosen + apply
  ["idle", "chosen apply", chosen(A, "apply"), sending, A],
  ["confirming", "chosen apply", chosen(B, "apply"), confirming],
  ["asking", "chosen apply", chosen(B, "apply"), asking],
  [
    "sending",
    "chosen apply",
    chosen(B, "apply"),
    { kind: "sending", inFlight: A, latest: B },
  ],
  [
    "queued",
    "chosen apply (latest wins)",
    chosen(C, "apply"),
    { kind: "sending", inFlight: A, latest: C },
  ],
  [
    "confirmed",
    "chosen apply",
    chosen(B, "apply"),
    { kind: "sending", inFlight: B, latest: B },
    B,
  ],
  ["uncertain", "chosen apply", chosen(B, "apply"), uncertain],
  [
    "unknownKind",
    "chosen apply",
    chosen(B, "apply"),
    { kind: "sending", inFlight: B, latest: B },
    B,
  ],
  // chosen + request
  ["idle", "chosen request", chosen(A, "request"), confirming],
  ["confirming", "chosen request", chosen(B, "request"), confirming],
  ["asking", "chosen request", chosen(B, "request"), asking],
  ["sending", "chosen request", chosen(B, "request"), sending],
  [
    "confirmed",
    "chosen request",
    chosen(B, "request"),
    { kind: "confirming", target: B },
  ],
  ["uncertain", "chosen request", chosen(B, "request"), uncertain],
  [
    "unknownKind",
    "chosen request",
    chosen(B, "request"),
    { kind: "confirming", target: B },
  ],
  // chosen + deny
  ["idle", "chosen deny", chosen(A, "deny"), IDLE],
  ["sending", "chosen deny", chosen(B, "deny"), sending],
  ["confirmed", "chosen deny", chosen(B, "deny"), confirmed],
  // confirm
  ["idle", "confirm", { type: "confirm" }, IDLE],
  ["confirming", "confirm", { type: "confirm" }, asking, A],
  ["asking", "confirm", { type: "confirm" }, asking],
  ["sending", "confirm", { type: "confirm" }, sending],
  ["uncertain", "confirm", { type: "confirm" }, uncertain],
  // dismiss
  ["idle", "dismiss", { type: "dismiss" }, IDLE],
  ["confirming", "dismiss", { type: "dismiss" }, IDLE],
  ["asking", "dismiss", { type: "dismiss" }, asking],
  ["sending", "dismiss", { type: "dismiss" }, sending],
  // applied
  ["idle", "applied", { type: "applied", generation: 5 }, IDLE],
  ["confirming", "applied", { type: "applied", generation: 5 }, confirming],
  [
    "asking",
    "applied (server applied a predicted request)",
    { type: "applied", generation: 5 },
    { kind: "confirmed", target: A, generation: 5 },
  ],
  [
    "sending",
    "applied",
    { type: "applied", generation: 5 },
    { kind: "confirmed", target: A, generation: 5 },
  ],
  [
    "queued",
    "applied (sends the queued target)",
    { type: "applied", generation: 5 },
    { kind: "sending", inFlight: B, latest: B },
    B,
  ],
  [
    "sending",
    "applied without a generation",
    { type: "applied", generation: undefined },
    IDLE,
  ],
  ["confirmed", "applied", { type: "applied", generation: 9 }, confirmed],
  ["uncertain", "applied", { type: "applied", generation: 9 }, uncertain],
  // requested
  ["idle", "requested", { type: "requested" }, IDLE],
  ["confirming", "requested", { type: "requested" }, confirming],
  ["asking", "requested", { type: "requested" }, IDLE],
  ["sending", "requested (prediction was wrong)", { type: "requested" }, IDLE],
  [
    "queued",
    "requested (queued target is dropped)",
    { type: "requested" },
    IDLE,
  ],
  ["confirmed", "requested", { type: "requested" }, confirmed],
  ["uncertain", "requested", { type: "requested" }, uncertain],
  // refused
  ["idle", "refused", { type: "refused" }, IDLE],
  ["asking", "refused", { type: "refused" }, IDLE],
  ["sending", "refused", { type: "refused" }, IDLE],
  [
    "queued",
    "refused (sends the queued target)",
    { type: "refused" },
    { kind: "sending", inFlight: B, latest: B },
    B,
  ],
  ["confirmed", "refused", { type: "refused" }, confirmed],
  ["uncertain", "refused", { type: "refused" }, uncertain],
  // unknown outcome: the write may have committed
  ["idle", "unknown", { type: "unknown", at: 200 }, IDLE],
  ["confirming", "unknown", { type: "unknown", at: 200 }, confirming],
  [
    "asking",
    "unknown",
    { type: "unknown", at: 200 },
    { kind: "uncertain", since: 200 },
  ],
  [
    "sending",
    "unknown",
    { type: "unknown", at: 200 },
    { kind: "uncertain", since: 200 },
  ],
  [
    "queued",
    "unknown (nothing is resent)",
    { type: "unknown", at: 200 },
    { kind: "uncertain", since: 200 },
  ],
  ["confirmed", "unknown", { type: "unknown", at: 200 }, confirmed],
  ["uncertain", "unknown", { type: "unknown", at: 200 }, uncertain],
  // read
  ["idle", "read", { type: "read", at: 300 }, IDLE],
  ["sending", "read", { type: "read", at: 300 }, sending],
  ["confirmed", "read", { type: "read", at: 300 }, confirmed],
  ["uncertain", "read after the failure", { type: "read", at: 100 }, IDLE],
  ["uncertain", "read after the failure", { type: "read", at: 300 }, IDLE],
  [
    "uncertain",
    "read from before the failure",
    { type: "read", at: 99 },
    uncertain,
  ],
];

describe("transition", () => {
  it.each(TABLE)("%s + %s", (name, _label, event, next, send) => {
    const step = transition(ENTRIES[name] as Entry, event);
    expect(step.entry).toEqual(next);
    expect(step.send).toEqual(send);
  });

  it("covers every entry kind with every event type", () => {
    const covered = new Set(
      TABLE.map(([name, , event]) => `${name}:${event.type}`),
    );
    const types = [
      "chosen",
      "confirm",
      "dismiss",
      "applied",
      "requested",
      "refused",
      "unknown",
      "read",
    ];
    // Entries the table skips are skipped on purpose: an event that does not
    // fit changes nothing. Check that claim here.
    for (const [name, entry] of Object.entries(ENTRIES)) {
      for (const type of types) {
        if (covered.has(`${name}:${type}`)) continue;
        const event: Event =
          type === "chosen"
            ? chosen(B, "apply")
            : type === "applied"
              ? { type: "applied", generation: 1 }
              : type === "unknown"
                ? { type: "unknown", at: 1 }
                : type === "read"
                  ? { type: "read", at: 1 }
                  : ({ type } as Event);
        const step = transition(entry, event);
        // chosen/applied/unknown may legitimately start or move a chain; the
        // others must leave an unlisted pair alone.
        if (["confirm", "dismiss", "requested", "refused"].includes(type)) {
          expect(step.entry).toBe(entry);
          expect(step.send).toBeUndefined();
        }
      }
    }
  });

  it("never sends from an ignored event", () => {
    for (const entry of [confirming, asking, uncertain]) {
      expect(transition(entry, chosen(B, "apply")).send).toBeUndefined();
    }
  });
});

describe("moveOf", () => {
  it("keeps the two known answers that are not the default", () => {
    expect(moveOf({ move: "apply" })).toBe("apply");
    expect(moveOf({ move: "deny" })).toBe("deny");
    expect(moveOf({ move: "request" })).toBe("request");
  });

  it("reads anything else as a request", () => {
    for (const value of [
      undefined,
      null,
      {},
      { move: "later" },
      { move: 1 },
      "apply",
    ]) {
      expect(moveOf(value)).toBe("request");
    }
  });
});

describe("shownStatus", () => {
  const server = { status: "to-do", statusGeneration: 3 };

  it("shows the latest choice while a write is in flight", () => {
    expect(shownStatus(server, sending)).toBe("in-progress");
    expect(shownStatus(server, queued)).toBe("done");
  });

  it("shows the target until a read reaches the write's generation", () => {
    expect(shownStatus({ ...server, statusGeneration: 3 }, confirmed)).toBe(
      "in-progress",
    );
    expect(shownStatus({ ...server, statusGeneration: 4 }, confirmed)).toBe(
      "to-do",
    );
    expect(
      shownStatus({ status: "in-review", statusGeneration: 6 }, confirmed),
    ).toBe("in-review");
  });

  it("lets the server win when the read has no generation", () => {
    expect(shownStatus({ status: "to-do" }, confirmed)).toBe("to-do");
    expect(
      shownStatus({ status: "to-do", statusGeneration: null }, confirmed),
    ).toBe("to-do");
  });

  it("shows the server value for every state that has not moved the status", () => {
    for (const entry of [IDLE, confirming, asking, uncertain, unknownKind]) {
      expect(shownStatus(server, entry)).toBe("to-do");
    }
    expect(shownStatus(server, undefined)).toBe("to-do");
  });

  it("gives the whole target for views that need its final flag", () => {
    expect(overlayTarget(server, queued)).toEqual(B);
    expect(overlayTarget(server, IDLE)).toBeNull();
  });
});

describe("isStatusLocked", () => {
  it("locks while a modal, a request or an unresolved write holds the task", () => {
    expect(isStatusLocked(confirming)).toBe(true);
    expect(isStatusLocked(asking)).toBe(true);
    expect(isStatusLocked(uncertain)).toBe(true);
  });

  it("leaves a task with a write in flight open: the next click wins", () => {
    for (const entry of [undefined, IDLE, sending, queued, confirmed]) {
      expect(isStatusLocked(entry)).toBe(false);
    }
  });

  it("treats an unknown kind as unlocked, the safe state", () => {
    expect(isStatusLocked(unknownKind)).toBe(false);
  });
});
