import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { resolveFileSecret } from "../../apps/api/src/utils/file-secret";
import { getGithubSsoOAuthCredentials } from "../../apps/api/src/utils/github-sso-env";

const keys = [
  "GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_SECRET",
  "GITHUB_OAUTH_CLIENT_SECRET_FILE",
  "GITHUB_CLIENT_ID",
] as const;

describe("file-backed secrets", () => {
  const original: Partial<Record<(typeof keys)[number], string | undefined>> =
    {};
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "baton-file-secret-"));
    for (const key of keys) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(directory, { recursive: true, force: true });
  });

  it("uses a direct value before its file, even when that file is missing", () => {
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "direct-secret";
    process.env.GITHUB_OAUTH_CLIENT_SECRET_FILE = path.join(
      directory,
      "missing",
    );

    expect(resolveFileSecret("GITHUB_OAUTH_CLIENT_SECRET")).toBe(
      "direct-secret",
    );
  });

  it("reads a file-backed OAuth secret and keeps it after the file is gone", () => {
    const file = path.join(directory, "oauth-secret");
    writeFileSync(file, " secret with spaces \r\n");
    process.env.GITHUB_OAUTH_CLIENT_ID = "client";
    process.env.GITHUB_OAUTH_CLIENT_SECRET_FILE = file;

    expect(resolveFileSecret("GITHUB_OAUTH_CLIENT_SECRET")).toBe(
      " secret with spaces ",
    );
    expect(getGithubSsoOAuthCredentials().clientSecret).toBe(
      "secret with spaces",
    );

    unlinkSync(file);
    expect(getGithubSsoOAuthCredentials().clientSecret).toBe(
      "secret with spaces",
    );
  });

  it("rejects missing and empty files instead of silently disabling OAuth", () => {
    const file = path.join(directory, "oauth-secret");
    process.env.GITHUB_OAUTH_CLIENT_ID = "client";
    process.env.GITHUB_OAUTH_CLIENT_SECRET_FILE = file;

    expect(() => getGithubSsoOAuthCredentials()).toThrow(
      "GITHUB_OAUTH_CLIENT_SECRET_FILE could not be read",
    );

    writeFileSync(file, "\n");
    expect(() => getGithubSsoOAuthCredentials()).toThrow(
      "GITHUB_OAUTH_CLIENT_SECRET_FILE points to an empty file",
    );
  });
});
