import { describe, expect, it } from "vite-plus/test";
import type { JoinLinkPreview } from "@/fetchers/join-link/types";
import {
  deriveJoinScreen,
  type JoinInputs,
  screenForJoinError,
  shouldAutoJoin,
} from "./join-screen-state";

const active: JoinLinkPreview = {
  status: "active",
  workspace: { name: "Shortcon" },
  sharedBy: { name: "Kabeer" },
  expiresAt: "2026-11-19T00:00:00.000Z",
};

const base: JoinInputs = {
  preview: { status: "success", data: active },
  session: "signed_in",
  join: { status: "idle" },
  autoJoin: false,
};

const derive = (override: Partial<JoinInputs>) =>
  deriveJoinScreen({ ...base, ...override });

describe("deriveJoinScreen", () => {
  it("loads until both the preview and the session are known", () => {
    expect(derive({ preview: { status: "pending" } })).toEqual({
      kind: "loading",
    });
    expect(derive({ session: "loading" })).toEqual({ kind: "loading" });
  });

  it("asks a signed-out visitor to sign up or in, and a signed-in one to join", () => {
    expect(derive({ session: "signed_out" })).toEqual({ kind: "signed_out" });
    expect(derive({})).toEqual({ kind: "ready" });
  });

  it("joins at once only when a sign-up round trip left an intent", () => {
    expect(derive({ autoJoin: true })).toEqual({ kind: "joining" });
    expect(derive({ autoJoin: true, session: "signed_out" })).toEqual({
      kind: "signed_out",
    });
  });

  it.each(["expired", "revoked", "used_up", "not_found"] as const)(
    "shows %s as unavailable",
    (reason) => {
      expect(
        derive({
          preview: {
            status: "success",
            data: { status: "unavailable", reason },
          },
        }),
      ).toEqual({ kind: "unavailable", reason });
    },
  );

  it("treats an unknown reason or status as unavailable, never active", () => {
    const unknownReason = {
      status: "unavailable",
      reason: "banned",
    } as unknown as JoinLinkPreview;
    const unknownStatus = { status: "paused" } as unknown as JoinLinkPreview;
    expect(
      derive({ preview: { status: "success", data: unknownReason } }),
    ).toEqual({
      kind: "unavailable",
      reason: "not_found",
    });
    expect(
      derive({ preview: { status: "success", data: unknownStatus } }),
    ).toEqual({
      kind: "unavailable",
      reason: "not_found",
    });
    expect(
      derive({
        preview: { status: "success", data: unknownStatus },
        autoJoin: true,
      }).kind,
    ).toBe("unavailable");
  });

  it("fails generically when the preview call fails", () => {
    expect(derive({ preview: { status: "error" } })).toEqual({
      kind: "failed",
      code: "generic",
    });
  });

  it("shows joining while the call runs, even over a stale preview error", () => {
    expect(derive({ join: { status: "pending" } })).toEqual({
      kind: "joining",
    });
    expect(
      derive({ join: { status: "pending" }, preview: { status: "error" } }),
    ).toEqual({
      kind: "joining",
    });
  });

  it("maps a failed join call to its screen", () => {
    expect(
      derive({ join: { status: "error", code: "REMOVED_FROM_WORKSPACE" } }),
    ).toEqual({
      kind: "failed",
      code: "REMOVED_FROM_WORKSPACE",
    });
  });
});

describe("screenForJoinError", () => {
  it.each([
    ["JOIN_LINK_EXPIRED", { kind: "unavailable", reason: "expired" }],
    ["JOIN_LINK_REVOKED", { kind: "unavailable", reason: "revoked" }],
    ["JOIN_LINK_USED_UP", { kind: "unavailable", reason: "used_up" }],
    ["JOIN_LINK_NOT_FOUND", { kind: "unavailable", reason: "not_found" }],
    [
      "WORKSPACE_MEMBER_LIMIT_REACHED",
      { kind: "failed", code: "WORKSPACE_MEMBER_LIMIT_REACHED" },
    ],
    ["RATE_LIMITED", { kind: "failed", code: "RATE_LIMITED" }],
    ["SOMETHING_NEW", { kind: "failed", code: "generic" }],
    [undefined, { kind: "failed", code: "generic" }],
  ])("maps %s", (code, screen) => {
    expect(screenForJoinError(code)).toEqual(screen);
  });
});

describe("shouldAutoJoin", () => {
  it("fires once: only while idle, with an intent, on a ready screen", () => {
    expect(shouldAutoJoin({ ...base, autoJoin: true })).toBe(true);
    expect(shouldAutoJoin({ ...base, autoJoin: false })).toBe(false);
    expect(
      shouldAutoJoin({ ...base, autoJoin: true, join: { status: "pending" } }),
    ).toBe(false);
    expect(
      shouldAutoJoin({
        ...base,
        autoJoin: true,
        join: { status: "error", code: "RATE_LIMITED" },
      }),
    ).toBe(false);
    expect(
      shouldAutoJoin({ ...base, autoJoin: true, session: "signed_out" }),
    ).toBe(false);
    expect(
      shouldAutoJoin({
        ...base,
        autoJoin: true,
        preview: {
          status: "success",
          data: { status: "unavailable", reason: "expired" },
        },
      }),
    ).toBe(false);
  });
});
