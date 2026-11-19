import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  getGithubSsoOAuthCredentials,
  isGithubSsoConfigured,
} from "../../../apps/api/src/utils/github-sso-env";

const keys = [
  "GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
] as const;

describe("github-sso-env", () => {
  const original: Partial<Record<(typeof keys)[number], string | undefined>> =
    {};

  beforeEach(() => {
    for (const key of keys) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const value = original[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("reads GITHUB_OAUTH_*", () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = "oauth-id";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "oauth-secret";
    expect(getGithubSsoOAuthCredentials()).toEqual({
      clientId: "oauth-id",
      clientSecret: "oauth-secret",
    });
    expect(isGithubSsoConfigured()).toBe(true);
  });

  it("ignores GITHUB_CLIENT_*", () => {
    process.env.GITHUB_CLIENT_ID = "other-id";
    process.env.GITHUB_CLIENT_SECRET = "other-secret";
    expect(getGithubSsoOAuthCredentials()).toEqual({
      clientId: "",
      clientSecret: "",
    });
    expect(isGithubSsoConfigured()).toBe(false);
  });

  it("treats a partial pair as absent", () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = "only-id";
    expect(getGithubSsoOAuthCredentials()).toEqual({
      clientId: "",
      clientSecret: "",
    });
    expect(isGithubSsoConfigured()).toBe(false);
  });
});
