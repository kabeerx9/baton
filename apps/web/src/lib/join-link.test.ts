import { describe, expect, it } from "vite-plus/test";
import { afterEach, beforeEach } from "vite-plus/test";
import {
  clearJoinIntent,
  hasJoinIntent,
  JOIN_INTENT_STORAGE_KEY,
  parseJoinToken,
  rememberJoinIntent,
} from "./join-link";

const TOKEN = "Ab3_-Zx9".repeat(5) + "Abc";

describe("parseJoinToken", () => {
  it("accepts a raw token, with surrounding space", () => {
    expect(TOKEN).toHaveLength(43);
    expect(parseJoinToken(TOKEN)).toBe(TOKEN);
    expect(parseJoinToken(`  ${TOKEN}\n`)).toBe(TOKEN);
  });

  it("accepts full URLs, with or without a scheme, query or slash", () => {
    expect(parseJoinToken(`https://app.baton.dev/join/${TOKEN}`)).toBe(TOKEN);
    expect(parseJoinToken(`http://localhost:5173/join/${TOKEN}/`)).toBe(TOKEN);
    expect(parseJoinToken(`app.baton.dev/join/${TOKEN}?x=1#y`)).toBe(TOKEN);
    expect(parseJoinToken(`/join/${TOKEN}`)).toBe(TOKEN);
  });

  it("rejects empty, short, long and wrongly shaped input", () => {
    expect(parseJoinToken("")).toBeNull();
    expect(parseJoinToken("   ")).toBeNull();
    expect(parseJoinToken(TOKEN.slice(1))).toBeNull();
    expect(parseJoinToken(`${TOKEN}x`)).toBeNull();
    expect(parseJoinToken(`${TOKEN.slice(1)}!`)).toBeNull();
    expect(parseJoinToken("hello world")).toBeNull();
  });

  it("rejects URLs whose path is not /join/<token>", () => {
    expect(parseJoinToken(`https://app.baton.dev/other/${TOKEN}`)).toBeNull();
    expect(
      parseJoinToken(`https://app.baton.dev/join/${TOKEN}/extra`),
    ).toBeNull();
    expect(parseJoinToken(`https://app.baton.dev/join/short`)).toBeNull();
    expect(parseJoinToken(`https://app.baton.dev/?t=${TOKEN}`)).toBeNull();
  });
});

describe("join intent", () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => window.sessionStorage.clear());

  it("matches only the token that was remembered", () => {
    expect(hasJoinIntent(TOKEN)).toBe(false);
    rememberJoinIntent(TOKEN);
    expect(window.sessionStorage.getItem(JOIN_INTENT_STORAGE_KEY)).toBe(TOKEN);
    expect(hasJoinIntent(TOKEN)).toBe(true);
    expect(hasJoinIntent("other")).toBe(false);
  });

  it("clears the intent", () => {
    rememberJoinIntent(TOKEN);
    clearJoinIntent();
    expect(hasJoinIntent(TOKEN)).toBe(false);
  });
});
