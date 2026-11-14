import fs from "node:fs/promises";
import path from "node:path";
import { isDefined, isUsed, scanSource } from "./scan.mjs";
import {
  flattenLocale,
  localePath,
  pruneLocale,
  readJson,
  repoRoot,
  writeJson,
} from "./shared.mjs";

// Fails when code uses a key en-US does not define. Computed keys are only
// counted. Unused keys are listed; `--fix` removes them from en-US.
// Only namespaces the web app reads are checked for unused keys. The API reads
// `invitations` and `notifications` from the same file, so they stay.
const READ_BY_API = new Set(["invitations", "notifications"]);
const shouldFix = process.argv.includes("--fix");
const listComputed = process.argv.includes("--computed");

async function sourceFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/u.test(entry.name) && !/\.test\./u.test(entry.name)
        ? [full]
        : [];
    }),
  );
  return nested.flat();
}

const locale = await readJson(localePath);
const localeKeys = flattenLocale(locale);
const namespaces = new Set(Object.keys(locale));

const staticKeys = new Set();
const dynamicPrefixes = [];
const dynamicCalls = [];
for (const file of await sourceFiles(path.join(repoRoot, "apps/web/src"))) {
  const scan = scanSource(await fs.readFile(file, "utf8"), namespaces);
  for (const key of scan.staticKeys) staticKeys.add(key);
  dynamicPrefixes.push(...scan.dynamicPrefixes);
  for (const call of scan.dynamicCalls)
    dynamicCalls.push(`${path.relative(repoRoot, file)}: ${call}`);
}

const webNamespaces = new Set(
  [...staticKeys, ...dynamicPrefixes].map((key) => key.split(":")[0]),
);
const sorted = (keys) => [...keys].sort((a, b) => a.localeCompare(b));
const missing = sorted(
  [...staticKeys].filter((key) => !isDefined(key, localeKeys)),
);
const unused = sorted(
  [...localeKeys].filter(
    (key) =>
      webNamespaces.has(key.split(":")[0]) &&
      !READ_BY_API.has(key.split(":")[0]) &&
      !isUsed(key, staticKeys, dynamicPrefixes),
  ),
);

const print = (title, lines) => {
  if (lines.length === 0) return;
  console.log(`${title}:`);
  for (const line of lines) console.log(`  - ${line}`);
};
print("Missing from en-US", missing);
// A template key such as `ns:board.columns.${status}` names a family. The
// family must still hold at least one en-US key, or the code points nowhere.
const emptyFamilies = sorted(
  new Set(
    dynamicPrefixes.filter(
      (prefix) =>
        prefix.includes(":") &&
        ![...localeKeys].some((key) => key.startsWith(prefix)),
    ),
  ),
);
print("Computed key family with no en-US keys", emptyFamilies);
if (dynamicCalls.length > 0)
  console.log(
    `${dynamicCalls.length} t() call(s) use a computed key and are not checked. Run with --computed to list them.`,
  );
if (listComputed) print("Computed t() calls", dynamicCalls);
print("Unused in en-US", unused);

if (shouldFix && unused.length > 0) {
  const allowed = new Set(localeKeys);
  for (const key of unused) allowed.delete(key);
  await writeJson(localePath, pruneLocale(locale, allowed));
  console.log(`Removed ${unused.length} unused key(s) from en-US.`);
}

if (missing.length === 0 && emptyFamilies.length === 0 && unused.length === 0)
  console.log("i18n check is clean.");
process.exit(missing.length > 0 || emptyFamilies.length > 0 ? 1 : 0);
