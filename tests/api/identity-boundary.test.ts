import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const root = fileURLToPath(new URL("../..", import.meta.url));
const apiSrc = join(root, "apps/api/src");
const webSrc = join(root, "apps/web/src");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx|mts|cts)$/.test(entry.name) ? [path] : [];
  });
}

// Static `from "..."`, side-effect `import "..."`, `import("...")` and
// `vi.mock("...")` all count.
const PROVIDER_IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\bmock\(\s*)["'](?:better-auth|@better-auth\/)[^"']*["']/;
const PROVIDER_TABLE = /\b(?:sessionTable|accountTable|verificationTable)\b/;
const CONTEXT_USER_OR_SESSION =
  /\b(?:get|set)\(\s*["'](?:user|session)["']|\bc\.var\.(?:user|session)\b/;

function offenders(
  dir: string,
  pattern: RegExp,
  allowed: (path: string) => boolean,
) {
  return sources(dir)
    .map((path) => relative(dir, path))
    .filter((path) => !allowed(path))
    .filter((path) => pattern.test(readFileSync(join(dir, path), "utf8")))
    .sort();
}

const inIdentity = (path: string) => path.startsWith("identity/");
const inDatabase = (path: string) => path.startsWith("database/");

/** What the web may ask the provider for (auth-boundary P4 A7). */
const WEB_AUTH_CLIENT_CALLS = [
  "changePassword",
  "deleteUser",
  "getSession",
  "linkSocial",
  "listAccounts",
  "requestPasswordReset",
  "resetPassword",
  "revokeOtherSessions",
  "signIn.email",
  "signOut",
  "signUp.email",
  "updateUser",
  "useSession",
];

describe("identity boundary (records/auth-boundary.md §1)", () => {
  it("lets only apps/api/src/identity import the provider", () => {
    expect(offenders(apiSrc, PROVIDER_IMPORT, inIdentity)).toEqual([]);
  });

  it("names the provider's tables only in identity and database", () => {
    expect(
      offenders(
        apiSrc,
        PROVIDER_TABLE,
        (path) => inIdentity(path) || inDatabase(path),
      ),
    ).toEqual([]);
  });

  it("lets only lib/auth-client.ts import the provider in the web", () => {
    expect(
      offenders(
        webSrc,
        PROVIDER_IMPORT,
        (path) => path === "lib/auth-client.ts",
      ),
    ).toEqual([]);
  });

  it("leaves no admin or API-key surface in the provider config (P4 A7)", () => {
    const config = readFileSync(
      join(apiSrc, "identity/better-auth/auth.ts"),
      "utf8",
    );
    expect(config).not.toMatch(/\/admin|\/api-key/);
  });

  it("calls the provider from the web only for identity (P4 A7)", () => {
    const calls = new Set(
      sources(webSrc).flatMap((path) =>
        [
          ...readFileSync(path, "utf8").matchAll(
            /\bauthClient\.((?:[a-zA-Z]+)(?:\.[a-zA-Z]+)?)/g,
          ),
        ].map((match) => match[1]!),
      ),
    );
    // `$store` is the client's own session cache, not a provider call.
    expect([...calls].sort()).toEqual(
      [...WEB_AUTH_CLIENT_CALLS].sort().filter((call) => calls.has(call)),
    );
  });

  it("keeps the provider's user and session out of the request context (P2 A8)", () => {
    expect(offenders(apiSrc, CONTEXT_USER_OR_SESSION, () => false)).toEqual([]);
  });

  it("detects every import form it bans", () => {
    for (const line of [
      'import { x } from "better-auth/api";',
      'import "better-auth";',
      'await import("better-auth/plugins");',
      'export { apiKey } from "@better-auth/api-key";',
      'vi.mock("better-auth/api", () => ({}));',
    ])
      expect(PROVIDER_IMPORT.test(line), line).toBe(true);
    expect(PROVIDER_IMPORT.test('import { auth } from "./auth";')).toBe(false);
    expect(CONTEXT_USER_OR_SESSION.test('c.get("user")')).toBe(true);
    expect(CONTEXT_USER_OR_SESSION.test("c.get('session')")).toBe(true);
    expect(CONTEXT_USER_OR_SESSION.test('c.get("userId")')).toBe(false);
  });
});
