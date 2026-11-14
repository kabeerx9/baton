import { describe, expect, it } from "vite-plus/test";
import {
  askedAgo,
  describeChange,
  fallbackCopy,
  makeRequest,
  phaseReducer,
  requesterName,
} from "./model";

const NOW = Date.UTC(2026, 10, 14, 12);

describe("change request prototype model", () => {
  it("describes each kind", () => {
    expect(describeChange(makeRequest("status", "web", NOW))).toBe(
      "Doing → Done",
    );
    expect(describeChange(makeRequest("archive", "web", NOW))).toBe("Archive");
    expect(describeChange(makeRequest("delete", "web", NOW))).toBe("Delete");
  });

  it("marks agent requests", () => {
    expect(requesterName(makeRequest("status", "agent", NOW))).toBe(
      "Rohan (agent)",
    );
  });

  it("says applies for a non-final status and expires otherwise", () => {
    const toDoing = {
      ...makeRequest("status", "web", NOW),
      targetStatus: "review",
    };
    expect(fallbackCopy(toDoing, NOW)).toMatch(
      /^Applies in about 21 hours.*\.$/,
    );
    expect(fallbackCopy(makeRequest("status", "web", NOW), NOW)).toMatch(
      /^Expires/,
    );
    expect(fallbackCopy(makeRequest("delete", "web", NOW), NOW)).toMatch(
      /^Expires/,
    );
  });

  it("formats age", () => {
    expect(askedAgo(makeRequest("status", "web", NOW), NOW)).toBe(
      "3 hours ago",
    );
  });

  it("moves through the phase machine and ignores stale events", () => {
    const sending = phaseReducer(
      { kind: "idle" },
      { type: "submit", action: "accept" },
    );
    expect(sending).toEqual({ kind: "submitting", action: "accept" });
    expect(phaseReducer(sending, { type: "submit", action: "reject" })).toBe(
      sending,
    );
    expect(phaseReducer(sending, { type: "fail", reason: "decided" })).toEqual({
      kind: "error",
      action: "accept",
      reason: "decided",
    });
    expect(phaseReducer({ kind: "idle" }, { type: "succeed" })).toEqual({
      kind: "idle",
    });
  });
});
