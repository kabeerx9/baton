import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { probeStorage } from "../../apps/api/src/admin/system/probe-storage";
import { newSigningSecret } from "../../apps/api/src/admin/webhooks/new-signing-secret";
import {
  decryptSecret,
  encryptSecret,
} from "../../apps/api/src/notification-preferences/secrets";
import {
  getGithubApp,
  resolveGithubPrivateKey,
} from "../../apps/api/src/plugins/github/utils/github-app";
import { assertStorageConfigured } from "../../apps/api/src/storage/s3";
import { getGithubSsoOAuthCredentials } from "../../apps/api/src/utils/github-sso-env";

const secretNames = [
  "GITHUB_PRIVATE_KEY",
  "GITHUB_PRIVATE_KEY_BASE64",
  "GITHUB_WEBHOOK_SECRET",
  "GITHUB_OAUTH_CLIENT_SECRET",
  "NOTIFICATION_SECRET_ENCRYPTION_KEY",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];
const keys = [
  ...secretNames,
  ...secretNames.map((name) => `${name}_FILE`),
  "GITHUB_OAUTH_CLIENT_ID",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "GITHUB_APP_ID",
];

describe("secrets read from _FILE variables", () => {
  const original: Record<string, string | undefined> = {};
  let directory: string;

  function secretFile(name: string, value: string) {
    const file = path.join(directory, name);
    writeFileSync(file, `${value}\n`);
    process.env[`${name}_FILE`] = file;
  }

  function missingSecretFile(name: string) {
    const file = path.join(directory, `missing-${name}`);
    process.env[`${name}_FILE`] = file;
    return file;
  }

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "baton-file-secret-sites-"));
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

  it("reads the GitHub App private key from a file", () => {
    secretFile(
      "GITHUB_PRIVATE_KEY",
      "-----BEGIN KEY-----\nabc\n-----END KEY-----",
    );
    expect(resolveGithubPrivateKey()).toBe(
      "-----BEGIN KEY-----\nabc\n-----END KEY-----",
    );
  });

  it("reads the base64 GitHub App private key from a file", () => {
    secretFile(
      "GITHUB_PRIVATE_KEY_BASE64",
      Buffer.from("pem").toString("base64"),
    );
    expect(resolveGithubPrivateKey()).toBe("pem");
  });

  it("reads GitHub sign-in client secrets from files", () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = "oauth-id";
    secretFile("GITHUB_OAUTH_CLIENT_SECRET", "oauth-secret");
    expect(getGithubSsoOAuthCredentials()).toEqual({
      clientId: "oauth-id",
      clientSecret: "oauth-secret",
    });
  });

  it("encrypts notification secrets with a key from a file", () => {
    secretFile("NOTIFICATION_SECRET_ENCRYPTION_KEY", "encryption-key");
    const encrypted = encryptSecret("webhook-token");
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(decryptSecret(encrypted)).toBe("webhook-token");
  });

  it("creates instance webhook signing secrets with a file-backed encryption key", () => {
    secretFile("NOTIFICATION_SECRET_ENCRYPTION_KEY", "encryption-key");
    const { secret, encrypted } = newSigningSecret();
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("reads S3 access keys from files", () => {
    process.env.S3_ENDPOINT = "https://s3.example.com";
    process.env.S3_BUCKET = "baton";
    secretFile("S3_ACCESS_KEY_ID", "access-key");
    secretFile("S3_SECRET_ACCESS_KEY", "secret-key");
    const config = assertStorageConfigured();
    expect(config.accessKeyId).toBe("access-key");
    expect(config.secretAccessKey).toBe("secret-key");
  });

  it("reports file-only partial storage configuration as a warning", async () => {
    missingSecretFile("S3_ACCESS_KEY_ID");
    expect(await probeStorage(100)).toEqual({
      status: "warning",
      configured: false,
      errorCode: "INCOMPLETE_CONFIG",
    });
  });

  it("skips GitHub App secret files when the app is not configured", () => {
    missingSecretFile("GITHUB_PRIVATE_KEY");
    missingSecretFile("GITHUB_WEBHOOK_SECRET");
    expect(getGithubApp()).toBeNull();
  });

  it("skips a GitHub sign-in secret file whose client ID is unset", () => {
    missingSecretFile("GITHUB_OAUTH_CLIENT_SECRET");
    expect(getGithubSsoOAuthCredentials()).toEqual({
      clientId: "",
      clientSecret: "",
    });
  });

  it("keeps S3 secret file paths out of upload errors", () => {
    process.env.S3_ENDPOINT = "https://s3.example.com";
    process.env.S3_BUCKET = "baton";
    const file = missingSecretFile("S3_ACCESS_KEY_ID");
    let message = "";
    try {
      assertStorageConfigured();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("S3_ACCESS_KEY_ID_FILE is invalid");
    expect(message).not.toContain(file);
  });
});
