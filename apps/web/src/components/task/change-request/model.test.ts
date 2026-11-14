import { describe, expect, it } from "vite-plus/test";
import {
  appliesOnTimeout,
  type BannerInput,
  deriveBanner,
  hoursLeft,
} from "./model";

const summary = {
  id: "r1",
  kind: "status",
  targetStatus: "done",
  requestedBy: "rohan",
  channel: "agent" as const,
  expiresAt: "2026-11-15T09:00:00.000Z",
};
const idle = {
  status: "idle" as const,
  requestId: undefined,
  decision: undefined,
  resultState: undefined,
  errorStatus: undefined,
};
const base: BannerInput = {
  summary,
  detail: undefined,
  canAnswer: false,
  userId: "neha",
  mutation: idle,
};

describe("deriveBanner", () => {
  it("is hidden with no request", () => {
    expect(deriveBanner({ ...base, summary: null }).kind).toBe("hidden");
  });

  it("gives the requester cancel, even when the server would let them answer", () => {
    const state = deriveBanner({ ...base, userId: "rohan", canAnswer: true });
    expect(state).toMatchObject({ kind: "open", role: "cancel" });
  });

  it("follows the server for who can answer", () => {
    expect(deriveBanner({ ...base, canAnswer: true })).toMatchObject({
      role: "answer",
    });
    expect(deriveBanner(base)).toMatchObject({ role: "observe" });
  });

  it("shows the decision in flight and a failure", () => {
    const pending = {
      ...idle,
      status: "pending" as const,
      requestId: "r1",
      decision: "accept" as const,
    };
    expect(
      deriveBanner({ ...base, canAnswer: true, mutation: pending }),
    ).toMatchObject({ sending: "accept", error: null });
    expect(
      deriveBanner({
        ...base,
        canAnswer: true,
        mutation: { ...pending, status: "error", errorStatus: 500 },
      }),
    ).toMatchObject({ sending: null, error: "failed" });
  });

  it("shows the recorded outcome after a decision, though the summary is gone", () => {
    const state = deriveBanner({
      ...base,
      summary: null,
      mutation: {
        ...idle,
        status: "success",
        requestId: "r1",
        resultState: "accepted",
      },
    });
    expect(state).toMatchObject({ kind: "closed", state: "accepted" });
  });

  it("turns a 409 into the outcome once the request is read again", () => {
    const detail = {
      id: "r1",
      kind: "status",
      targetStatus: "done",
      baseStatus: "doing",
      requestedBy: "rohan",
      channel: "agent" as const,
      createdAt: "2026-11-14T09:00:00.000Z",
      expiresAt: summary.expiresAt,
      state: "rejected",
    };
    const conflict = {
      ...idle,
      status: "error" as const,
      requestId: "r1",
      decision: "accept" as const,
      errorStatus: 409,
    };
    expect(
      deriveBanner({ ...base, canAnswer: true, mutation: conflict }),
    ).toMatchObject({ kind: "open", error: "decided" });
    expect(
      deriveBanner({ ...base, detail, canAnswer: true, mutation: conflict }),
    ).toMatchObject({ kind: "closed", state: "rejected" });
  });

  it("treats a state it does not know as closed", () => {
    const detail = {
      id: "r1",
      kind: "status",
      targetStatus: "done",
      baseStatus: "doing",
      requestedBy: "rohan",
      channel: null,
      createdAt: "2026-11-14T09:00:00.000Z",
      expiresAt: summary.expiresAt,
      state: "from_the_future",
    };
    expect(deriveBanner({ ...base, detail }).kind).toBe("closed");
  });
});

describe("timing", () => {
  it("rounds hours and never goes below one", () => {
    const now = Date.parse("2026-11-14T12:00:00.000Z");
    expect(hoursLeft("2026-11-15T09:00:00.000Z", now)).toBe(21);
    expect(hoursLeft("2026-11-14T11:00:00.000Z", now)).toBe(1);
  });

  it("applies only a status request to a non-final column that is known", () => {
    const status = { kind: "status", targetStatus: "doing" };
    expect(appliesOnTimeout(status, new Set(["done"]))).toBe(true);
    expect(appliesOnTimeout(status, new Set(["doing"]))).toBe(false);
    expect(appliesOnTimeout(status, undefined)).toBe(false);
    expect(
      appliesOnTimeout({ kind: "delete", targetStatus: null }, new Set()),
    ).toBe(false);
  });
});
