import { randomBytes } from "node:crypto";

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
// The largest multiple of 52 below 256: bytes at or above it are dropped,
// so every letter is equally likely.
const UNBIASED_LIMIT = 256 - (256 % LETTERS.length);

export const API_KEY_SECRET_LENGTH = 64;
export const API_KEY_START_LENGTH = 6;

/** `length` random letters, a-z and A-Z, as the plugin made them. */
export function randomLetters(
  length: number,
  random: (size: number) => Uint8Array = randomBytes,
): string {
  let out = "";
  while (out.length < length) {
    for (const byte of random(length - out.length + 16)) {
      if (byte >= UNBIASED_LIMIT) continue;
      out += LETTERS[byte % LETTERS.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/** A new secret and the `start` shown in lists (it includes the prefix). */
export function generateApiKey(prefix: string | undefined) {
  const key = `${prefix ?? ""}${randomLetters(API_KEY_SECRET_LENGTH)}`;
  return { key, start: key.slice(0, API_KEY_START_LENGTH) };
}
