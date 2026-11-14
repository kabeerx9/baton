import { describe, expect, it } from "vite-plus/test";
import {
  assertNoOAuthSignIn,
  assertOAuthCallbackLinks,
  isLinkState,
} from "./oauth-sign-in-guard";

describe("assertNoOAuthSignIn", () => {
  it.each(["/sign-in/social", "/callback/:id", "/callback/github"])(
    "refuses a session started by %s",
    (path) => {
      expect(() => assertNoOAuthSignIn(path)).toThrow(
        expect.objectContaining({
          body: expect.objectContaining({ code: "OAUTH_SIGN_IN_DISABLED" }),
        }),
      );
    },
  );

  it.each(["/sign-in/email", "/sign-up/email", "/reset-password", undefined])(
    "allows a session started by %s",
    (path) => {
      expect(() => assertNoOAuthSignIn(path)).not.toThrow();
    },
  );
});

describe("isLinkState", () => {
  it("accepts a state started by /link-social", () => {
    expect(
      isLinkState(JSON.stringify({ link: { userId: "u1", email: "a@b.c" } })),
    ).toBe(true);
  });

  it.each([
    undefined,
    "",
    "not json",
    JSON.stringify({ callbackURL: "/" }),
    JSON.stringify({ link: { userId: "" } }),
  ])("rejects %j", (value) => {
    expect(isLinkState(value)).toBe(false);
  });
});

describe("assertOAuthCallbackLinks", () => {
  const ctx = (path: string, state: string | undefined, value?: string) => ({
    path,
    query: { state },
    context: {
      internalAdapter: {
        findVerificationValue: async (identifier: string) =>
          identifier === `auth-state:${state}` && value ? { value } : null,
      },
    },
  });
  const link = JSON.stringify({ link: { userId: "u1", email: "a@b.c" } });

  it("ignores other paths", async () => {
    await expect(
      assertOAuthCallbackLinks(ctx("/sign-in/email", undefined)),
    ).resolves.toBeUndefined();
  });

  it("allows a link callback", async () => {
    await expect(
      assertOAuthCallbackLinks(ctx("/callback/:id", "s1", link)),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["no state", undefined, undefined],
    ["an unknown state", "s1", undefined],
    ["a sign-in state", "s1", JSON.stringify({ callbackURL: "/" })],
  ])("refuses %s", async (_label, state, value) => {
    await expect(
      assertOAuthCallbackLinks(ctx("/callback/:id", state, value)),
    ).rejects.toMatchObject({
      body: expect.objectContaining({ code: "OAUTH_SIGN_IN_DISABLED" }),
    });
  });
});
