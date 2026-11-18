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

/**
 * Files outside the boundary that still reach the provider, each removed or
 * cleaned by the named phase of `records/auth-boundary.md`. The test asserts
 * the list exactly, so an entry that no longer offends must be deleted here.
 */
const API_PROVIDER_IMPORTS_UNTIL: Record<string, "P3" | "P4"> = {
  "admin/audit/capture-auth-admin-audit.ts": "P4",
  "admin/audit/record-auth-admin-audit.ts": "P4",
  "admin/roles/assert-known-instance-roles.ts": "P4",
  "project-access/resolve-invitation-project-access.ts": "P3",
  "user/controllers/prepare-admin-user-removal.ts": "P4",
  "utils/assert-owner-invitation-resend-allowed.ts": "P3",
  "utils/native-auth-api-key.ts": "P3",
  "utils/native-organization-read-access.ts": "P3",
  "workspace-members/assert-invitation-owner-allowed.ts": "P3",
  "workspace-members/assert-stored-owner-role-safe.ts": "P3",
  "workspace/archive/assert-native-organization-active.ts": "P3",
  "workspace/kind/assert-shareable-workspace.ts": "P3",
  "workspace/lifecycle/delete-native-workspace.ts": "P3",
};

const API_PROVIDER_TABLES_UNTIL: Record<string, "P3" | "P4"> = {
  "admin/audit/capture-auth-admin-audit.ts": "P4",
  "tour/demo/delete-demo-workspace.ts": "P3",
  "workspace/lifecycle/delete-workspace-data.ts": "P3",
};

const WEB_PROVIDER_IMPORTS_UNTIL: Record<string, "P3" | "P4"> = {
  "types/user.ts": "P3",
};

describe("identity boundary (records/auth-boundary.md §1)", () => {
  it("lets only apps/api/src/identity import the provider", () => {
    expect(offenders(apiSrc, PROVIDER_IMPORT, inIdentity)).toEqual(
      Object.keys(API_PROVIDER_IMPORTS_UNTIL).sort(),
    );
  });

  it("names the provider's tables only in identity and database", () => {
    expect(
      offenders(
        apiSrc,
        PROVIDER_TABLE,
        (path) => inIdentity(path) || inDatabase(path),
      ),
    ).toEqual(Object.keys(API_PROVIDER_TABLES_UNTIL).sort());
  });

  it("lets only lib/auth-client.ts import the provider in the web", () => {
    expect(
      offenders(
        webSrc,
        PROVIDER_IMPORT,
        (path) => path === "lib/auth-client.ts",
      ),
    ).toEqual(Object.keys(WEB_PROVIDER_IMPORTS_UNTIL).sort());
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
