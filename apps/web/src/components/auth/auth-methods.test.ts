import { describe, expect, it } from "vite-plus/test";
import type { GetConfigResponse } from "@/fetchers/config/get-config";
import {
  getSafeRedirectPath,
  getSignInFooter,
  isPasswordSignUpEnabled,
} from "./auth-methods";

function config(overrides: Partial<GetConfigResponse> = {}) {
  return {
    disableRegistration: false,
    disablePasswordRegistration: false,
    ...overrides,
  } as GetConfigResponse;
}

describe("auth methods", () => {
  it("signs up with a password, except when it is switched off", () => {
    expect(isPasswordSignUpEnabled(config(), false)).toBe(true);
    expect(
      isPasswordSignUpEnabled(
        config({ disablePasswordRegistration: true }),
        false,
      ),
    ).toBe(false);
  });

  it("hides password sign-up until the config has loaded", () => {
    expect(isPasswordSignUpEnabled(undefined, false)).toBe(false);
  });

  it("always signs up with a password during instance setup", () => {
    expect(
      isPasswordSignUpEnabled(
        config({ disablePasswordRegistration: true }),
        true,
      ),
    ).toBe(true);
    expect(isPasswordSignUpEnabled(undefined, true)).toBe(true);
  });

  it.each([
    [{}, "createAccount"],
    [{ disableRegistration: true }, "inviteOnly"],
    [{ disablePasswordRegistration: true }, "inviteOnly"],
  ] as const)("chooses the sign-in footer for %j", (overrides, footer) => {
    expect(getSignInFooter(config(overrides))).toBe(footer);
  });

  it.each([
    ["/dashboard/settings", "/dashboard/settings"],
    ["//evil.example", undefined],
    ["https://evil.example", undefined],
    [undefined, undefined],
  ])("only keeps same-origin redirect %s", (path, expected) => {
    expect(getSafeRedirectPath(path)).toBe(expected);
  });
});
