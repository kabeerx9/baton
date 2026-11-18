import { describe, expect, it } from "vite-plus/test";
import { deriveLinkState } from "./lifecycle";

const now = new Date("2026-11-18T12:00:00.000Z");
const later = new Date("2026-11-19T12:00:00.000Z");
const earlier = new Date("2026-11-17T12:00:00.000Z");

const row = (overrides: Partial<Parameters<typeof deriveLinkState>[0]>) => ({
  revokedAt: null,
  expiresAt: later,
  maxUses: null,
  useCount: 0,
  ...overrides,
});

describe("deriveLinkState", () => {
  it("is active before expiry with uses left", () => {
    expect(deriveLinkState(row({}), now)).toEqual({ kind: "active" });
    expect(deriveLinkState(row({ maxUses: 2, useCount: 1 }), now)).toEqual({
      kind: "active",
    });
  });

  it("is expired exactly at expiresAt", () => {
    expect(deriveLinkState(row({ expiresAt: now }), now)).toEqual({
      kind: "expired",
      at: now,
    });
  });

  it("is active one millisecond before expiresAt", () => {
    const expiresAt = new Date(now.getTime() + 1);
    expect(deriveLinkState(row({ expiresAt }), now).kind).toBe("active");
  });

  it("is used up when the count reaches the limit", () => {
    expect(deriveLinkState(row({ maxUses: 1, useCount: 1 }), now)).toEqual({
      kind: "used_up",
    });
    expect(deriveLinkState(row({ maxUses: 1, useCount: 5 }), now).kind).toBe(
      "used_up",
    );
  });

  it("puts revoked before expired and used up", () => {
    expect(
      deriveLinkState(
        row({
          revokedAt: earlier,
          expiresAt: earlier,
          maxUses: 1,
          useCount: 1,
        }),
        now,
      ),
    ).toEqual({ kind: "revoked", at: earlier });
  });

  it("puts expired before used up", () => {
    expect(
      deriveLinkState(row({ expiresAt: earlier, maxUses: 1, useCount: 1 }), now)
        .kind,
    ).toBe("expired");
  });

  it("never uses up a link without a limit", () => {
    expect(deriveLinkState(row({ useCount: 10_000 }), now).kind).toBe("active");
  });
});
