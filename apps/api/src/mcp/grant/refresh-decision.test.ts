import { describe, expect, it } from "vite-plus/test";
import { REFRESH_GRACE_MS } from "./constants";
import { decideRefresh } from "./refresh-decision";

const now = new Date("2026-11-15T12:00:00Z");
const later = new Date(now.getTime() + 60_000);
const live = { revokedAt: null, idleExpiresAt: later };
const fresh = { rotatedAt: null, expiresAt: later };

describe("decideRefresh", () => {
  it("rotates the current token of an active grant", () => {
    expect(decideRefresh({ grant: live, token: fresh, now })).toEqual({
      kind: "rotate",
    });
  });

  it("allows a rotated token inside the grace window", () => {
    const rotatedAt = new Date(now.getTime() - REFRESH_GRACE_MS);
    expect(
      decideRefresh({ grant: live, token: { ...fresh, rotatedAt }, now }),
    ).toEqual({ kind: "grace" });
  });

  it("revokes on reuse after the grace window", () => {
    const rotatedAt = new Date(now.getTime() - REFRESH_GRACE_MS - 1);
    expect(
      decideRefresh({ grant: live, token: { ...fresh, rotatedAt }, now }),
    ).toEqual({ kind: "revoke" });
  });

  it.each([
    ["revoked", { revokedAt: now, idleExpiresAt: later }],
    ["idle_expired", { revokedAt: null, idleExpiresAt: now }],
    ["idle_expired", { revokedAt: null, idleExpiresAt: new Date(Number.NaN) }],
  ] as const)("rejects a %s grant", (reason, grant) => {
    expect(decideRefresh({ grant, token: fresh, now })).toEqual({
      kind: "reject",
      reason,
    });
  });

  it("rejects an expired token and fails closed on invalid times", () => {
    expect(
      decideRefresh({
        grant: live,
        token: { rotatedAt: null, expiresAt: now },
        now,
      }),
    ).toEqual({ kind: "reject", reason: "token_expired" });
    expect(
      decideRefresh({
        grant: live,
        token: { rotatedAt: new Date(Number.NaN), expiresAt: later },
        now,
      }),
    ).toEqual({ kind: "revoke" });
  });
});
