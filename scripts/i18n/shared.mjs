import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(__dirname, "../..");
export const localePath = path.join(repoRoot, "i18n", "en-US.json");

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, "\t")}\n`);
}

/** Every leaf key of the locale, as `namespace:dotted.path`. */
export function flattenLocale(localeData) {
  const keys = new Set();
  const walk = (value, prefix) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [child, next] of Object.entries(value))
        walk(next, `${prefix}${prefix.endsWith(":") ? "" : "."}${child}`);
      return;
    }
    keys.add(prefix);
  };
  for (const [namespace, value] of Object.entries(localeData))
    walk(value, `${namespace}:`);
  return keys;
}

/** Keep only the leaves whose key is in `allowedKeys`; drop empty branches. */
export function pruneLocale(localeData, allowedKeys) {
  const prune = (value, prefix) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const next = {};
      for (const [child, nested] of Object.entries(value)) {
        const pruned = prune(
          nested,
          `${prefix}${prefix.endsWith(":") ? "" : "."}${child}`,
        );
        if (pruned !== undefined) next[child] = pruned;
      }
      return Object.keys(next).length > 0 ? next : undefined;
    }
    return allowedKeys.has(prefix) ? value : undefined;
  };
  const result = {};
  for (const [namespace, value] of Object.entries(localeData)) {
    const pruned = prune(value, `${namespace}:`);
    if (pruned !== undefined) result[namespace] = pruned;
  }
  return result;
}
