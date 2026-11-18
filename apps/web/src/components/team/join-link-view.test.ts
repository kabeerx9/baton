import { describe, expect, it } from "vite-plus/test";
import type { JoinLink } from "@/fetchers/join-link/types";
import {
  deriveJoinLinkView,
  needsReplaceConfirm,
  parseMaxUses,
} from "./join-link-view";

const NOW = Date.parse("2026-11-18T12:00:00.000Z");
const link = (over: Partial<JoinLink> = {}): JoinLink => ({
  id: "l1",
  state: "active",
  url: "https://x/join/t",
  expiresAt: "2026-11-19T12:00:00.000Z",
  createdAt: "2026-11-18T10:00:00.000Z",
  createdBy: { id: "u1", name: "Kabeer" },
  maxUses: 10,
  useCount: 3,
  ...over,
});

describe("deriveJoinLinkView", () => {
  it("shows none, active, and active without a url", () => {
    expect(deriveJoinLinkView(null, NOW)).toEqual({ kind: "none" });
    expect(deriveJoinLinkView(link(), NOW)).toEqual({
      kind: "active",
      url: "https://x/join/t",
    });
    expect(deriveJoinLinkView(link({ url: null }), NOW)).toEqual({
      kind: "active_no_url",
    });
  });

  it("shows expired and used up from the server state", () => {
    expect(
      deriveJoinLinkView(link({ state: "expired", url: null }), NOW).kind,
    ).toBe("expired");
    expect(
      deriveJoinLinkView(link({ state: "used_up", url: null }), NOW).kind,
    ).toBe("used_up");
  });

  it("does not trust a stale active row: expiry and uses are checked on this clock", () => {
    expect(
      deriveJoinLinkView(link({ expiresAt: "2026-11-18T12:00:00.000Z" }), NOW)
        .kind,
    ).toBe("expired");
    expect(deriveJoinLinkView(link({ useCount: 10 }), NOW).kind).toBe(
      "used_up",
    );
  });

  it("treats an unknown state as expired, never active", () => {
    const unknown = link({ state: "paused" as unknown as JoinLink["state"] });
    expect(deriveJoinLinkView(unknown, NOW).kind).toBe("expired");
  });
});

describe("needsReplaceConfirm", () => {
  it("asks only when a live link would be replaced", () => {
    expect(needsReplaceConfirm({ kind: "active", url: "u" })).toBe(true);
    expect(needsReplaceConfirm({ kind: "active_no_url" })).toBe(true);
    expect(needsReplaceConfirm({ kind: "none" })).toBe(false);
    expect(needsReplaceConfirm({ kind: "expired" })).toBe(false);
    expect(needsReplaceConfirm({ kind: "used_up" })).toBe(false);
  });
});

describe("parseMaxUses", () => {
  it("accepts empty as no limit and whole numbers 1..10000", () => {
    expect(parseMaxUses("")).toEqual({ ok: true, value: null });
    expect(parseMaxUses(" 25 ")).toEqual({ ok: true, value: 25 });
    expect(parseMaxUses("10000")).toEqual({ ok: true, value: 10000 });
  });
  it("rejects zero, too large, decimals, negatives and text", () => {
    for (const bad of ["0", "10001", "1.5", "-2", "abc", "1e3"]) {
      expect(parseMaxUses(bad)).toEqual({ ok: false });
    }
  });
});
