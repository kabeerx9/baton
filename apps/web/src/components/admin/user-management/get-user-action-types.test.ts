import { describe, expect, it } from "vite-plus/test";
import { getUserActionTypes } from "./get-user-action-types";

const options = {
  isSelf: false,
  permissions: ["users:credentials", "users:disable", "users:delete"] as const,
};

describe("getUserActionTypes", () => {
  it("offers verification actions only for unverified addresses", () => {
    expect(
      getUserActionTypes({ emailVerified: true, banned: false }, options),
    ).toEqual(["sendPasswordReset", "deactivate", "delete"]);
    expect(
      getUserActionTypes({ emailVerified: false, banned: true }, options),
    ).toEqual([
      "sendPasswordReset",
      "sendVerification",
      "markEmailVerified",
      "reactivate",
      "delete",
    ]);
  });

  it("never offers deactivating or deleting yourself", () => {
    expect(
      getUserActionTypes(
        { emailVerified: true, banned: false },
        { ...options, isSelf: true },
      ),
    ).toEqual(["sendPasswordReset"]);
  });

  it("offers only the actions the viewer has permission for", () => {
    expect(
      getUserActionTypes(
        { emailVerified: false, banned: false },
        { ...options, permissions: ["users:disable"] },
      ),
    ).toEqual(["deactivate"]);
  });
});
