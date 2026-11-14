import { describe, expect, it } from "vite-plus/test";
import { getSignInMethodLabel } from "./get-sign-in-method-label";

const t = (key: string) => `t:${key}`;

describe("getSignInMethodLabel", () => {
  it("names passwords and GitHub", () => {
    expect(getSignInMethodLabel("credential", t)).toBe(
      "t:settings:adminUsers.details.methods.password",
    );
    expect(getSignInMethodLabel("github", t)).toBe("t:auth:providers.github");
  });

  it("shows unknown provider ids as they are", () => {
    expect(getSignInMethodLabel("google", t)).toBe("google");
  });
});
