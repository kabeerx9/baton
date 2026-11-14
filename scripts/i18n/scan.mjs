const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/u;

/** Keys the source passes to `t()`, plus calls whose key is not a literal. */
export function scanSource(source, namespaces) {
  const staticKeys = new Set();
  const dynamicCalls = [];
  const dynamicPrefixes = [];

  for (const match of source.matchAll(
    /\b(?:[\w$]+\.)?t\(\s*(['"])([^'"\\]+)\1/gu,
  ))
    staticKeys.add(match[2]);

  for (const match of source.matchAll(/\bi18nKey\s*=\s*(['"])([^'"\\]+)\1/gu))
    staticKeys.add(match[2]);

  // Keys also travel as plain values (error handlers return them). A real
  // namespace plus a dotted path keeps Tailwind variants and storage keys out.
  for (const match of source.matchAll(
    /(['"])([a-z][\w-]*):([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+)\1/gu,
  ))
    if (namespaces.has(match[2])) staticKeys.add(`${match[2]}:${match[3]}`);

  for (const match of source.matchAll(
    /\b(?:[\w$]+\.)?t\(\s*(`[^`]*\$\{[^`]*\}`|[^'"`\s][^,\n)]*)/gu,
  )) {
    const call = match[0].trim();
    dynamicCalls.push(call);
    const prefix = call.match(/`([^`$]*)\$\{/u)?.[1];
    if (prefix) dynamicPrefixes.push(prefix);
  }

  return { staticKeys, dynamicCalls, dynamicPrefixes };
}

/** A used key is defined when en-US has it or any of its plural forms. */
export function isDefined(key, localeKeys) {
  if (localeKeys.has(key)) return true;
  return ["zero", "one", "two", "few", "many", "other"].some((form) =>
    localeKeys.has(`${key}_${form}`),
  );
}

export function isUsed(key, staticKeys, dynamicPrefixes) {
  if (staticKeys.has(key)) return true;
  const base = key.replace(PLURAL_SUFFIX, "");
  if (base !== key && staticKeys.has(base)) return true;
  return dynamicPrefixes.some((prefix) => key.startsWith(prefix));
}
