import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  generateJoinToken,
  hashJoinToken,
  isJoinToken,
  joinLinkUrl,
  parseJoinToken,
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

describe("parseJoinToken", () => {
  const token = generateJoinToken();

  it("reads the token from what people paste", () => {
    for (const pasted of [
      token,
      `  ${token}\n`,
      `https://baton.example/join/${token}`,
      ` http://localhost:5173/join/${token}/ `,
      `baton.example/join/${token}`,
      `/join/${token}`,
      `https://baton.example/join?t=${token}`,
    ]) {
      expect(parseJoinToken(pasted), pasted).toBe(token);
    }
  });

  it("returns null for anything else", () => {
    for (const pasted of [
      "",
      "   ",
      "garbage",
      `${token}x`,
      `${token} ${token}`,
      `https://baton.example/join/${token}/more`,
      `https://baton.example/elsewhere/${token}`,
      `https://baton.example/join?t=${token}x`,
      "https://",
      // Malformed URLs on each branch must not throw.
      "//[",
      "/[",
      "https://[",
    ]) {
      expect(parseJoinToken(pasted), pasted).toBeNull();
    }
  });
});
