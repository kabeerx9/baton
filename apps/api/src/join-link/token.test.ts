import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  generateJoinToken,
  hashJoinToken,
  isJoinToken,
  joinLinkUrl,
} from "./token";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("join tokens", () => {
  it("generates 43-character base64url tokens that differ", () => {
    const first = generateJoinToken();
    const second = generateJoinToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isJoinToken(first)).toBe(true);
    expect(first).not.toBe(second);
  });

  it("hashes to stable sha256 hex", () => {
    const token = generateJoinToken();
    expect(hashJoinToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashJoinToken(token)).toBe(hashJoinToken(token));
    expect(hashJoinToken(token)).not.toBe(hashJoinToken(`${token}x`));
  });

  it("refuses malformed tokens", () => {
    expect(isJoinToken("")).toBe(false);
    expect(isJoinToken("a".repeat(42))).toBe(false);
    expect(isJoinToken("a".repeat(44))).toBe(false);
    expect(isJoinToken(`${"a".repeat(42)}=`)).toBe(false);
    expect(isJoinToken(`${"a".repeat(42)}/`)).toBe(false);
  });

  it("builds the web URL from the client base", () => {
    vi.stubEnv("BATON_CLIENT_URL", "https://baton.example.com/");
    expect(joinLinkUrl("abc")).toBe("https://baton.example.com/join/abc");
  });
});
