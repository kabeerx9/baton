// A2: the Baton workspace routes against the provider's permission matrix
// (fixtures/workspace-permission-matrix.json, captured before the plugin
// went). Allow and deny must match, except the intended differences of
// auth-boundary §3 named below. Error codes are Baton's (difference 7), so
// only the allow or deny outcome is compared.
import { beforeAll, describe, expect, it } from "vite-plus/test";
import matrix from "./fixtures/workspace-permission-matrix.json";
import { resetTestDatabase } from "./helpers/database";
import {
  ACTIONS,
  ACTORS,
  type Cell,
  WRITE_ACTIONS,
  type WritesFixture,
  writesFixture,
} from "./helpers/workspace-writes";

/** The actions the provider fixture has; transfer is Baton's own. */
const MATRIX_ACTIONS = Object.keys(matrix.roles.owner);
const MATRIX_WRITES = WRITE_ACTIONS.filter((action) =>
  MATRIX_ACTIONS.includes(action),
);

type Outcome = "allow" | "deny";
const outcome = (cell: Cell): Outcome =>
  cell.status >= 200 && cell.status < 300 ? "allow" : "deny";

/** Where Baton differs from the provider on purpose, with the §3 reason. */
const DIFFERENCES: Record<string, { cell: Cell; why: string }> = {
  "member.role-to-owner": {
    cell: { status: 400, code: "UNKNOWN_ROLE" },
    why: "§3 difference 1: owner is given only by the transfer route",
  },
  "roles.delete-seeded": {
    cell: { status: 400, code: "DEFAULT_ROLE" },
    why: "§3 difference 11: the seeded viewer, member and admin roles cannot be deleted or renamed",
  },
};

/** What the provider allowed that Baton now refuses, for an actor that could. */
function expected(provider: Cell, action: string): Outcome {
  if (DIFFERENCES[action] && outcome(provider) === "allow") return "deny";
  return outcome(provider);
}

let ctx: WritesFixture;

beforeAll(async () => {
  await resetTestDatabase();
  ctx = await writesFixture();
}, 60_000);

describe("roles against the provider matrix (A2)", () => {
  for (const actor of ACTORS) {
    it(`matches for ${actor}`, { timeout: 120_000 }, async () => {
      const mismatches: string[] = [];
      for (const action of MATRIX_ACTIONS) {
        const seeded = await ctx.seed(actor);
        const got = await ctx.cell(
          ACTIONS[action]!(seeded),
          actor === "outsider"
            ? ctx.as.cookie("outsider")
            : ctx.as.cookie(actor),
        );
        const provider = (matrix.roles as Record<string, Record<string, Cell>>)[
          actor
        ]![action]!;
        if (outcome(got) !== expected(provider, action))
          mismatches.push(
            `${action}: provider ${provider.status}, Baton ${got.status} ${got.code}`,
          );
        if (outcome(got) === "deny")
          expect(got.status, `${actor} ${action}`).toBeGreaterThanOrEqual(400);
        // An outsider never learns more than "not here" or "not yours".
        if (actor === "outsider") expect([403, 404]).toContain(got.status);
      }
      expect(mismatches).toEqual([]);
    });
  }

  it("refuses the differences with their own codes", async () => {
    for (const [action, { cell }] of Object.entries(DIFFERENCES)) {
      const seeded = await ctx.seed("owner");
      expect(
        await ctx.cell(ACTIONS[action]!(seeded), ctx.as.cookie("owner")),
        action,
      ).toEqual(cell);
    }
  });
});

describe("API key scopes against the provider matrix (A2)", () => {
  // Each action's scope, as `utils/native-auth-api-key.ts` asked for it.
  const SCOPES: Record<string, Record<string, string[]>> = {
    "workspace.read": { workspace: ["read"] },
    "members.list": { workspace: ["read"] },
    "workspace.update": { workspace: ["update"] },
    "workspace.delete": { workspace: ["delete"] },
    "workspace.leave": { workspace: ["manage_settings"] },
    "member.remove": { member: ["delete"] },
    "member.remove-owner": { member: ["delete"] },
    "member.role": { member: ["update"] },
    "member.role-of-owner": { member: ["update"] },
    "member.role-to-owner": { member: ["update"] },
    "roles.list": { role: ["read"] },
    "roles.create": { role: ["create"] },
    "roles.create-beyond-own": { role: ["create"] },
    "roles.update": { role: ["update"] },
    "roles.update-beyond-own": { role: ["update"] },
    "roles.update-seeded": { role: ["update"] },
    "roles.rename-to-owner": { role: ["update"] },
    "roles.delete": { role: ["delete"] },
    "roles.delete-seeded": { role: ["delete"] },
    "roles.delete-in-use": { role: ["delete"] },
  };

  it(
    "matches for the owner's unscoped, exact and read-only keys",
    {
      timeout: 120_000,
    },
    async () => {
      const unscoped = (await ctx.keyFor("owner", null)).key;
      const readOnly = (await ctx.keyFor("owner", { workspace: ["read"] })).key;
      const mismatches: string[] = [];
      for (const action of MATRIX_ACTIONS) {
        const exact = (await ctx.keyFor("owner", SCOPES[action]!)).key;
        for (const [name, key] of [
          ["unscoped", unscoped],
          ["exact", exact],
          ["workspace:read", readOnly],
        ] as const) {
          const seeded = await ctx.seed("owner");
          const got = await ctx.cell(ACTIONS[action]!(seeded), ctx.as.key(key));
          const provider = (
            matrix.ownerApiKeys as Record<string, Record<string, Cell>>
          )[name]![action]!;
          if (outcome(got) !== expected(provider, action))
            mismatches.push(
              `${name} ${action}: provider ${provider.status}, Baton ${got.status} ${got.code}`,
            );
        }
      }
      expect(mismatches).toEqual([]);
    },
  );

  it("refuses leave and create to a key without workspace:manage_settings", async () => {
    const key = (await ctx.keyFor("owner", { member: ["update"] })).key;
    const seeded = await ctx.seed("owner");
    const left = await ctx.cell(
      ACTIONS["workspace.leave"]!(seeded),
      ctx.as.key(key),
    );
    expect(left).toEqual({ status: 403, code: "API_KEY_SCOPE" });
    const created = await ctx.cell(
      { method: "POST", path: "/workspace", body: { name: "Keyed" } },
      ctx.as.key(key),
    );
    expect(created).toEqual({ status: 403, code: "API_KEY_SCOPE" });
  });
});

describe("creation against the provider matrix (A2)", () => {
  it("allows a session, an unscoped key and a manage_settings key, refuses a read key", async () => {
    const create = (headers: Record<string, string>) =>
      ctx.cell(
        { method: "POST", path: "/workspace", body: { name: "Created" } },
        headers,
      );
    const got = {
      session: await create(ctx.as.cookie("member")),
      unscopedKey: await create(
        ctx.as.key((await ctx.keyFor("owner", null)).key),
      ),
      manageSettingsKey: await create(
        ctx.as.key(
          (await ctx.keyFor("owner", { workspace: ["manage_settings"] })).key,
        ),
      ),
      readKey: await create(
        ctx.as.key((await ctx.keyFor("owner", { workspace: ["read"] })).key),
      ),
    };
    for (const [name, provider] of Object.entries(matrix.creation))
      expect([name, outcome(got[name as keyof typeof got])]).toEqual([
        name,
        outcome(provider as Cell),
      ]);
    expect(got.session.status).toBe(201);
    expect(got.readKey).toEqual({ status: 403, code: "API_KEY_SCOPE" });
  });
});

describe("rules against the provider matrix (A2)", () => {
  it(
    "refuses every write to the owner of an archived workspace",
    {
      timeout: 60_000,
    },
    async () => {
      for (const action of MATRIX_WRITES) {
        const seeded = await ctx.seed("owner", { archived: true });
        expect([
          action,
          await ctx.cell(ACTIONS[action]!(seeded), ctx.as.cookie("owner")),
        ]).toEqual([
          action,
          matrix.rules.archivedOwner[action as "workspace.update"],
        ]);
      }
    },
  );
});
