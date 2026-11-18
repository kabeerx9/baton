import { readFileSync } from "node:fs";
import type { schema } from "../../../apps/api/src/database";

type ApiKeyRow = typeof schema.apikeyTable.$inferSelect;
type Offsets =
  | "createdAt"
  | "updatedAt"
  | "expiresAt"
  | "lastRefillAt"
  | "lastRequest";
type StoredRow = Omit<ApiKeyRow, Offsets> & Record<Offsets, number | null>;

export type Observed = {
  status: number;
  code: string | null;
  headers: Record<string, string | null>;
};

export type PluginKeyName =
  | "plain"
  | "prefixed"
  | "rate-limited"
  | "scoped"
  | "expiring"
  | "expired"
  | "disabled";

/** `tests/fixtures/api-keys/plugin-api-keys.json`, recorded with the plugin. */
export const pluginKeyFixture = JSON.parse(
  readFileSync(
    new URL("../../fixtures/api-keys/plugin-api-keys.json", import.meta.url),
    "utf8",
  ),
) as {
  owner: { id: string; email: string; name: string };
  workspace: { id: string; name: string };
  keys: Record<PluginKeyName, { secret: string; row: StoredRow }>;
  behaviour: Record<PluginKeyName, Record<string, Observed[]>>;
};

/** The recorded row with its times moved so they keep their offsets from `now`. */
export function pluginKeyRow(name: PluginKeyName, now = Date.now()): ApiKeyRow {
  const { row } = pluginKeyFixture.keys[name];
  const at = (offset: number | null) =>
    offset === null ? null : new Date(now + offset);
  return {
    ...row,
    createdAt: at(row.createdAt)!,
    updatedAt: at(row.updatedAt)!,
    expiresAt: at(row.expiresAt),
    lastRefillAt: at(row.lastRefillAt),
    lastRequest: at(row.lastRequest),
  };
}

export const pluginKeyNames = Object.keys(
  pluginKeyFixture.keys,
) as PluginKeyName[];

type RequestApp = {
  request(path: string, init: RequestInit): Response | Promise<Response>;
};
const RATE_HEADERS = [
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "retry-after",
];

async function observe(
  app: RequestApp,
  path: string,
  key: string,
): Promise<Observed> {
  const response = await app.request(path, { headers: { "x-api-key": key } });
  const body = (await response.json().catch(() => null)) as {
    code?: string;
  } | null;
  return {
    status: response.status,
    code: body?.code ?? null,
    headers: Object.fromEntries(
      RATE_HEADERS.map((name) => {
        const value = response.headers.get(name);
        if (value === null) return [name, null];
        return [
          name,
          name === "x-ratelimit-reset" || name === "retry-after"
            ? "present"
            : value,
        ];
      }),
    ),
  };
}

/**
 * Sends the recorder's requests in its order: one per key, then the
 * rate-limited key's remaining three, then the two workspace reads. The
 * result compares to `pluginKeyFixture.behaviour`.
 */
export async function replayPluginKeyRequests(app: RequestApp) {
  const { keys } = pluginKeyFixture;
  const seen: Record<string, Record<string, Observed[]>> = {};
  for (const name of pluginKeyNames) {
    seen[name] = {
      "/api/user/me": [await observe(app, "/api/user/me", keys[name].secret)],
    };
  }
  for (let i = 0; i < 3; i += 1) {
    seen["rate-limited"]!["/api/user/me"]!.push(
      await observe(app, "/api/user/me", keys["rate-limited"].secret),
    );
  }
  seen.scoped!["/api/workspace"] = [
    await observe(app, "/api/workspace", keys.scoped.secret),
  ];
  seen.plain!["/api/workspace"] = [
    await observe(app, "/api/workspace", keys.plain.secret),
  ];
  return seen;
}
