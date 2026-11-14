import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { resolveDatabaseConfig } from "../../apps/api/src/database/resolve-database-url";
import { resolveAuthSecret } from "../../apps/api/src/utils/auth-secret";
import { getGithubSsoOAuthCredentials } from "../../apps/api/src/utils/github-sso-env";

const SECRET_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_USER",
  "POSTGRES_DB",
  "POSTGRES_PASSWORD",
  "POSTGRES_PASSWORD_FILE",
  "AUTH_SECRET",
  "AUTH_SECRET_FILE",
  "GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_SECRET",
  "GITHUB_OAUTH_CLIENT_SECRET_FILE",
] as const;

let savedEnv: Record<string, string | undefined>;
let directory: string;

beforeEach(() => {
  savedEnv = Object.fromEntries(
    SECRET_ENV_KEYS.map((key) => [key, process.env[key]]),
  );
  directory = mkdtempSync(path.join(tmpdir(), "baton-file-secrets-"));
});

afterEach(() => {
  for (const key of SECRET_ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  rmSync(directory, { recursive: true, force: true });
});

describe("API integration: file-backed secrets", () => {
  it("connects to PostgreSQL with only POSTGRES_PASSWORD_FILE", async () => {
    const testDatabase = new URL(process.env.DATABASE_URL ?? "");
    const passwordFile = path.join(directory, "postgres-password");
    writeFileSync(
      passwordFile,
      `${decodeURIComponent(testDatabase.password)}\n`,
    );

    delete process.env.DATABASE_URL;
    process.env.POSTGRES_HOST = testDatabase.hostname;
    process.env.POSTGRES_PORT = testDatabase.port || "5432";
    process.env.POSTGRES_USER = decodeURIComponent(testDatabase.username);
    process.env.POSTGRES_DB = testDatabase.pathname.replace(/^\//, "");
    process.env.POSTGRES_PASSWORD = "";
    process.env.POSTGRES_PASSWORD_FILE = passwordFile;

    const config = resolveDatabaseConfig();
    expect(config.source).toBe("POSTGRES_ENV");

    const pool = new Pool({ connectionString: config.connectionString });
    try {
      const result = await pool.query<{ database: string }>(
        "select current_database() as database",
      );
      expect(result.rows[0]?.database).toBe(process.env.POSTGRES_DB);
    } finally {
      await pool.end();
    }
  });

  it("uses the AUTH_SECRET_FILE contents as the auth secret", () => {
    const authFile = path.join(directory, "auth-secret");
    const secret = "f".repeat(64);
    writeFileSync(authFile, `${secret}\n`);

    process.env.AUTH_SECRET = "";
    process.env.AUTH_SECRET_FILE = authFile;

    expect(resolveAuthSecret()).toBe(secret);
  });

  it("reads the GitHub link client secret from GITHUB_OAUTH_CLIENT_SECRET_FILE", () => {
    const clientSecretFile = path.join(directory, "github-oauth-client-secret");
    writeFileSync(clientSecretFile, "github-client-secret\n");

    process.env.GITHUB_OAUTH_CLIENT_ID = "baton";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "";
    process.env.GITHUB_OAUTH_CLIENT_SECRET_FILE = clientSecretFile;

    expect(getGithubSsoOAuthCredentials()).toEqual({
      clientId: "baton",
      clientSecret: "github-client-secret",
    });
  });
});
