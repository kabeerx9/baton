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
