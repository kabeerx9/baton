import { randomInt } from "node:crypto";

const MAX_SLUG = 48;
const SUFFIX_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
export const SLUG_ATTEMPTS = 5;

/** Lower case; runs of other characters become "-"; at most 48 characters. */
export function slugFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/, "");
  return slug || "workspace";
}

/** The slug for a retry after a conflict: the base, "-", 6 base-36 characters. */
export function slugWithSuffix(
  base: string,
  random: (max: number) => number = randomInt,
): string {
  let suffix = "";
  for (let i = 0; i < 6; i++)
    suffix += SUFFIX_ALPHABET[random(SUFFIX_ALPHABET.length)];
  return `${base}-${suffix}`;
}
