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

/** Every event the machine knows. Chosen events pick B. */
const EVENTS = {
  apply: chosen(B, "apply"),
  request: chosen(B, "request"),
  deny: chosen(B, "deny"),
  confirm: { type: "confirm" },
  dismiss: { type: "dismiss" },
  applied: { type: "applied", generation: 5 },
  appliedNoGeneration: { type: "applied", generation: undefined },
  requested: { type: "requested" },
  refused: { type: "refused" },
  unknown: { type: "unknown", at: 200 },
  readAfter: { type: "read", at: 300 },
  readAtFailure: { type: "read", at: 100 },
  readBefore: { type: "read", at: 99 },
} satisfies Record<string, Event>;

type EventName = keyof typeof EVENTS;

/** "same": the event does not fit, so the entry is untouched and nothing is sent. */
const same = "same" as const;
type Cell = typeof same | { entry: Entry; send?: Target };
const to = (entry: Entry, send?: Target): Cell => ({ entry, send });

const SENDING_B = { kind: "sending", inFlight: B, latest: B } as const;

/** The whole machine: every entry x every event, with no gaps. */
const MATRIX: Record<string, Record<EventName, Cell>> = {
  idle: {
    apply: to(SENDING_B, B),
    request: to({ kind: "confirming", target: B }),
    deny: to(IDLE),
    confirm: to(IDLE),
    dismiss: to(IDLE),
    applied: to(IDLE),
    appliedNoGeneration: to(IDLE),
    requested: to(IDLE),
    refused: to(IDLE),
    unknown: to(IDLE),
    readAfter: to(IDLE),
    readAtFailure: to(IDLE),
    readBefore: to(IDLE),
  },
  confirming: {
    apply: same,
    request: same,
    deny: same,
    confirm: to(asking, A),
    dismiss: to(IDLE),
    applied: same,
    appliedNoGeneration: same,
    requested: same,
    refused: same,
    unknown: same,
    readAfter: same,
    readAtFailure: same,
    readBefore: same,
  },
  asking: {
    apply: same,
    request: same,
    deny: same,
    confirm: same,
    dismiss: same,
    // The server applied what we predicted would only ask.
    applied: to({ kind: "confirmed", target: A, generation: 5 }),
    appliedNoGeneration: to(IDLE),
    requested: to(IDLE),
    refused: to(IDLE),
    unknown: to({ kind: "uncertain", since: 200 }),
    readAfter: same,
    readAtFailure: same,
    readBefore: same,
  },
  sending: {
    apply: to({ kind: "sending", inFlight: A, latest: B }),
    request: same,
    deny: same,
    confirm: same,
    dismiss: same,
    applied: to({ kind: "confirmed", target: A, generation: 5 }),
    appliedNoGeneration: to(IDLE),
    // The prediction was wrong: the request ends the chain.
    requested: to(IDLE),
    refused: to(IDLE),
    unknown: to({ kind: "uncertain", since: 200 }),
    readAfter: same,
    readAtFailure: same,
    readBefore: same,
  },
  queued: {
    apply: to({ kind: "sending", inFlight: A, latest: B }),
    request: same,
    deny: same,
    confirm: same,
    dismiss: same,
    applied: to(SENDING_B, B),
    appliedNoGeneration: to(SENDING_B, B),
    // A request drops the queued target: it is never sent.
    requested: to(IDLE),
    refused: to(SENDING_B, B),
    // Nothing is resent after an unknown outcome.
    unknown: to({ kind: "uncertain", since: 200 }),
    readAfter: same,
    readAtFailure: same,
    readBefore: same,
  },
  confirmed: {
    apply: to(SENDING_B, B),
    request: to({ kind: "confirming", target: B }),
    deny: same,
    confirm: same,
    dismiss: same,
    applied: same,
    appliedNoGeneration: same,
    requested: same,
    refused: same,
    unknown: same,
    readAfter: same,
    readAtFailure: same,
    readBefore: same,
  },
  uncertain: {
    apply: same,
    request: same,
    deny: same,
    confirm: same,
    dismiss: same,
    applied: same,
    appliedNoGeneration: same,
    requested: same,
    refused: same,
    unknown: same,
    readAfter: to(IDLE),
    readAtFailure: to(IDLE),
    readBefore: same,
  },
  // A kind this build does not know acts as idle: the safe state.
  unknownKind: {
    apply: to(SENDING_B, B),
    request: to({ kind: "confirming", target: B }),
    deny: same,
    confirm: same,
    dismiss: same,
    applied: same,
    appliedNoGeneration: same,
    requested: same,
    refused: same,
    unknown: same,
    readAfter: same,
    readAtFailure: same,
    readBefore: same,
  },
};

const PAIRS = Object.keys(ENTRIES).flatMap((entry) =>
  (Object.keys(EVENTS) as EventName[]).map((event) => [entry, event] as const),
);

describe("transition", () => {
  it("has a row for every entry kind and every event, with no gaps", () => {
    expect(Object.keys(MATRIX).sort()).toEqual(Object.keys(ENTRIES).sort());
    for (const [entry, event] of PAIRS) {
      expect(MATRIX[entry]?.[event], `${entry} + ${event}`).toBeDefined();
    }
    for (const row of Object.values(MATRIX)) {
      expect(Object.keys(row).sort()).toEqual(Object.keys(EVENTS).sort());
    }
  });

  it.each(PAIRS)("%s + %s", (name, event) => {
    const entry = ENTRIES[name] as Entry;
    const cell = MATRIX[name]![event];
    const step = transition(entry, EVENTS[event]);
    if (cell === same) {
      expect(step.entry).toBe(entry);
      expect(step.send).toBeUndefined();
    } else {
      expect(step.entry).toEqual(cell.entry);
      expect(step.send).toEqual(cell.send);
    }
  });

  it("sends at most when it starts a chain or moves one on", () => {
    for (const [name, event] of PAIRS) {
      const cell = MATRIX[name]![event];
      if (cell !== same && cell.send) {
        expect(["chosen", "confirm", "applied", "refused"]).toContain(
          EVENTS[event].type,
        );
      }
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

  it("never shows an archive or an unarchive ahead of the server (R1.1)", () => {
    const archive: Entry = {
      kind: "sending",
      inFlight: { status: "archived", isFinal: true },
      latest: { status: "archived", isFinal: true },
    };
    expect(shownStatus(server, archive)).toBe("to-do");
    // Unarchive: the stored status is "archived".
    expect(
      shownStatus({ status: "archived", statusGeneration: 3 }, sending),
    ).toBe("archived");
    expect(
      shownStatus({ status: "archived", statusGeneration: 3 }, confirmed),
    ).toBe("archived");
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
