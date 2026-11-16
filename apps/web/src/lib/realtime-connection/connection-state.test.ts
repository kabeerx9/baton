import { describe, expect, it } from "vite-plus/test";
import {
  type CloseVerdict,
  holdsSocket,
  isLive,
  shouldPoll,
  transition,
  type ConnectionEvent,
  type ConnectionState,
} from "./connection-state";

type S = ConnectionState<"gone-for-good">;
type E = ConnectionEvent<"gone-for-good">;
const closed = (verdict: CloseVerdict<"gone-for-good">): E => ({
  type: "closed",
  verdict,
});

describe("transition", () => {
  it.each<[string, S, E, S]>([
    [
      "connecting opens",
      { status: "connecting", failures: 2 },
      { type: "opened" },
      { status: "open", failures: 2 },
    ],
    [
      "open becomes stable",
      { status: "open", failures: 2 },
      { type: "stable" },
      { status: "stable" },
    ],
    [
      "connecting closes and retries",
      { status: "connecting", failures: 2 },
      closed("retry"),
      { status: "waiting", failures: 3, hurried: false, recheck: false },
    ],
    [
      "open then close keeps failures",
      { status: "open", failures: 1 },
      closed("retry"),
      { status: "waiting", failures: 2, hurried: false, recheck: false },
    ],
    [
      "stable then close starts from one failure",
      { status: "stable" },
      closed("retry"),
      { status: "waiting", failures: 1, hurried: false, recheck: false },
    ],
    [
      "close 4001 checks the session with no wait",
      { status: "open", failures: 0 },
      closed("check-session"),
      { status: "checking", failures: 1 },
    ],
    [
      "waiting retries",
      { status: "waiting", failures: 3, hurried: true, recheck: false },
      { type: "retry-due" },
      { status: "connecting", failures: 3 },
    ],
    [
      "wake hurries a wait once and keeps failures",
      { status: "waiting", failures: 4, hurried: false, recheck: false },
      { type: "wake" },
      { status: "waiting", failures: 4, hurried: true, recheck: false },
    ],
    [
      "same session connects",
      { status: "checking", failures: 1 },
      { type: "session", result: "same" },
      { status: "connecting", failures: 1 },
    ],
    [
      "gone session ends",
      { status: "checking", failures: 1 },
      { type: "session", result: "gone" },
      { status: "ended", reason: "session-ended" },
    ],
    [
      "unknown session waits",
      { status: "checking", failures: 1 },
      { type: "session", result: "unknown" },
      { status: "waiting", failures: 2, hurried: false, recheck: true },
    ],
    [
      "a wait after an unknown check re-checks",
      { status: "waiting", failures: 2, hurried: false, recheck: true },
      { type: "retry-due" },
      { status: "checking", failures: 2 },
    ],
    [
      "wake hurries the re-check",
      { status: "waiting", failures: 2, hurried: false, recheck: true },
      { type: "wake" },
      { status: "waiting", failures: 2, hurried: true, recheck: true },
    ],
    [
      "terminal close ends",
      { status: "connecting", failures: 0 },
      closed({ end: "gone-for-good" }),
      { status: "ended", reason: "gone-for-good" },
    ],
    [
      "end event ends from waiting",
      { status: "waiting", failures: 2, hurried: false, recheck: false },
      { type: "end", reason: "disposed" },
      { status: "ended", reason: "disposed" },
    ],
  ])("%s", (_, from, event, to) => {
    expect(transition(from, event)).toEqual(to);
  });

  it("ended absorbs every event", () => {
    const ended: S = { status: "ended", reason: "disposed" };
    for (const event of [
      { type: "opened" },
      { type: "stable" },
      { type: "retry-due" },
      { type: "wake" },
      closed("retry"),
      { type: "session", result: "same" },
      { type: "end", reason: "gone-for-good" },
    ] satisfies E[])
      expect(transition(ended, event)).toBe(ended);
  });

  it.each<[S, E]>([
    [{ status: "connecting", failures: 1 }, { type: "wake" }],
    [{ status: "open", failures: 1 }, { type: "wake" }],
    [{ status: "stable" }, { type: "wake" }],
    [{ status: "checking", failures: 1 }, { type: "wake" }],
    [
      { status: "waiting", failures: 1, hurried: true, recheck: false },
      { type: "wake" },
    ],
    [
      { status: "waiting", failures: 1, hurried: false, recheck: false },
      { type: "opened" },
    ],
    [
      { status: "waiting", failures: 1, hurried: false, recheck: false },
      closed("retry"),
    ],
    [{ status: "open", failures: 1 }, { type: "retry-due" }],
    [{ status: "connecting", failures: 1 }, { type: "stable" }],
    [
      { status: "waiting", failures: 1, hurried: false, recheck: false },
      { type: "session", result: "same" },
    ],
  ])("an unlisted pair returns the same object (%j, %j)", (state, event) => {
    expect(transition(state, event)).toBe(state);
  });
});

describe("derived state", () => {
  it("isLive is true only for open and stable", () => {
    expect(isLive({ status: "open", failures: 0 })).toBe(true);
    expect(isLive({ status: "stable" })).toBe(true);
    expect(isLive({ status: "connecting", failures: 0 })).toBe(false);
    expect(
      isLive({
        status: "waiting",
        failures: 1,
        hurried: false,
        recheck: false,
      }),
    ).toBe(false);
    expect(isLive({ status: "ended", reason: "disposed" })).toBe(false);
  });

  it("holdsSocket also covers a socket that has not opened", () => {
    expect(holdsSocket({ status: "connecting", failures: 0 })).toBe(true);
    expect(holdsSocket({ status: "open", failures: 0 })).toBe(true);
    expect(
      holdsSocket({
        status: "waiting",
        failures: 1,
        hurried: false,
        recheck: false,
      }),
    ).toBe(false);
    expect(holdsSocket({ status: "checking", failures: 1 })).toBe(false);
  });

  it("shouldPoll starts at 5 failures and never when live or ended", () => {
    expect(
      shouldPoll({
        status: "waiting",
        failures: 4,
        hurried: false,
        recheck: false,
      }),
    ).toBe(false);
    expect(
      shouldPoll({
        status: "waiting",
        failures: 5,
        hurried: false,
        recheck: false,
      }),
    ).toBe(true);
    expect(shouldPoll({ status: "connecting", failures: 9 })).toBe(true);
    expect(shouldPoll({ status: "checking", failures: 5 })).toBe(true);
    expect(shouldPoll({ status: "open", failures: 9 })).toBe(false);
    expect(shouldPoll({ status: "stable" })).toBe(false);
    expect(shouldPoll({ status: "ended", reason: "disposed" })).toBe(false);
  });
});
