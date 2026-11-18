import assert from "node:assert/strict";
import test from "node:test";
import { isDefined, isUsed, scanSource } from "./scan.mjs";
import { flattenLocale, pruneLocale } from "./shared.mjs";

const namespaces = new Set(["common"]);

test("finds literal keys and flags dynamic keys", () => {
  const scan = scanSource(
    `t("common:a.b"); i18nKey="common:c.d"; t(\`common:x.\${id}\`); t(key);`,
    namespaces,
  );
  assert.deepEqual([...scan.staticKeys].sort(), ["common:a.b", "common:c.d"]);
  assert.equal(scan.dynamicCalls.length, 2);
  assert.deepEqual(scan.dynamicPrefixes, ["common:x."]);
});

test("a used key that en-US lacks is missing", () => {
  const keys = flattenLocale({
    common: { a: { b: "B" }, n_one: "1", n_other: "n" },
  });
  assert.equal(isDefined("common:a.b", keys), true);
  assert.equal(isDefined("common:n", keys), true);
  assert.equal(isDefined("common:a.gone", keys), false);
});

test("plural forms and dynamic prefixes count as used", () => {
  const used = new Set(["common:n"]);
  assert.equal(isUsed("common:n_other", used, []), true);
  assert.equal(isUsed("common:x.y", used, ["common:x."]), true);
  assert.equal(isUsed("common:z", used, []), false);
});

test("pruning drops unused leaves and empty branches", () => {
  const data = { common: { keep: "k", drop: { deep: "d" } } };
  assert.deepEqual(pruneLocale(data, new Set(["common:keep"])), {
    common: { keep: "k" },
  });
});

test("useTranslation(ns) qualifies the file's unqualified keys", () => {
  const scan = scanSource(
    `const { t } = useTranslation("tour"); t("next"); t("common:a.b"); t(\`steps.\${id}.title\`);`,
    new Set(["common", "tour"]),
  );
  assert.deepEqual([...scan.staticKeys].sort(), ["common:a.b", "tour:next"]);
  assert.deepEqual(scan.dynamicPrefixes, ["tour:steps."]);
});

test("two default namespaces in one file leave keys as written", () => {
  const scan = scanSource(
    `useTranslation("tour"); useTranslation("common"); t("next");`,
    new Set(["common", "tour"]),
  );
  assert.deepEqual([...scan.staticKeys], ["next"]);
});

test("a template with text after the interpolation is a computed key", () => {
  const scan = scanSource(`t(\`common:x.\${id}.title\`);`, namespaces);
  assert.equal(scan.dynamicCalls.length, 1);
  assert.deepEqual(scan.dynamicPrefixes, ["common:x."]);
});
