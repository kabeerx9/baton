import { describe, expect, it } from "vite-plus/test";
import {
  FILTERED,
  failClosed,
  scrubBreadcrumb,
  scrubDeep,
  scrubEvent,
  scrubLog,
  scrubText,
} from "./scrub";

const JOIN_TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd"; // 42 chars
const API_KEY = `acme_${"x".repeat(64)}`;

describe("scrubText", () => {
  it.each([
    ["join link path", `https://app.test/join/${JOIN_TOKEN}`, JOIN_TOKEN],
    ["short join token", "/join/short-token?x=1", "short-token"],
    ["join token query", "https://app.test/auth/sign-up?t=abc123", "abc123"],
    [
      "reset token query",
      "/auth/reset-password?token=tok_123&next=/x",
      "tok_123",
    ],
    ["reset token path", "/api/auth/reset-password/tok_123", "tok_123"],
    ["invitation id", "/invitation/accept/inv_123", "inv_123"],
    ["OAuth code", "/api/mcp/callback?code=c0de&state=st4te", "c0de"],
    ["OAuth state", "/api/mcp/callback?code=c0de&state=st4te", "st4te"],
    ["bearer token", "Authorization: Bearer sk_live_123", "sk_live_123"],
    ["basic credentials", "Basic dXNlcjpwYXNz", "dXNlcjpwYXNz"],
    ["prefixed API key", `key was ${API_KEY}`, API_KEY],
    ["API key in query", "/api/task?api_key=short1", "short1"],
    [
      "MCP access token",
      "token baton_mcp_at_abcDEF123_-",
      "baton_mcp_at_abcDEF123",
    ],
    [
      "session cookie",
      "cookie: better-auth.session_token=sess.abc; theme=dark",
      "sess.abc",
    ],
    [
      "secure session cookie",
      "__Secure-better-auth.session_token=sess.abc",
      "sess.abc",
    ],
    [
      "presigned S3 URL",
      "https://bucket.s3.amazonaws.com/a.png?X-Amz-Algorithm=AWS4&X-Amz-Credential=AKIA/x&X-Amz-Signature=deadbeef",
      "AKIA",
    ],
    [
      "Slack webhook",
      "POST https://hooks.slack.com/services/T000/B000/secretXYZ",
      "secretXYZ",
    ],
    [
      "Discord webhook",
      "https://discord.com/api/webhooks/123/tokenXYZ",
      "tokenXYZ",
    ],
    ["webhook secret query", "/hook?secret=whsec_1", "whsec_1"],
    ["URL credentials", "postgres://baton:hunter2@db:5432/x", "hunter2"],
    ["email address", "user alice@example.com failed", "alice@example.com"],
    ["encoded join path", `/x?next=%2Fjoin%2F${JOIN_TOKEN}`, JOIN_TOKEN],
  ])("removes the %s", (_name, input, secret) => {
    const out = scrubText(input);
    expect(out).not.toContain(secret);
  });

  it("keeps ordinary text, ids and routes readable", () => {
    const text =
      "GET /api/task/clx1abc2def3ghi4jkl5mno6 returned 404 for workspace ws_12";
    expect(scrubText(text)).toBe(text);
  });

  it("is idempotent", () => {
    const once = scrubText(`/join/${JOIN_TOKEN}?code=1 Bearer abc`);
    expect(scrubText(once)).toBe(once);
  });

  it("does not throw on malformed percent-encoding", () => {
    expect(() => scrubText("/join/%E0%A4%A?code=1")).not.toThrow();
    expect(scrubText("/x?code=%E0%A4%A")).toBe(`/x?code=${FILTERED}`);
  });
});

describe("scrubDeep", () => {
  it("scrubs nested strings and keeps non-strings", () => {
    const value = {
      url: "/join/abc",
      list: [1, null, true, "Bearer x"],
      nested: { deeper: { email: "a@b.io" } },
    };
    expect(scrubDeep(value)).toEqual({
      url: `/join/${FILTERED}`,
      list: [1, null, true, `Bearer ${FILTERED}`],
      nested: { deeper: { email: "[email]" } },
    });
  });

  it("stops at a fixed depth instead of recursing forever", () => {
    type Loop = { self?: Loop; text: string };
    const loop: Loop = { text: "x" };
    loop.self = loop;
    expect(() => scrubDeep(loop)).not.toThrow();
  });
});

describe("Sentry item scrubbers", () => {
  it("scrubs breadcrumb messages and data URLs", () => {
    const crumb = scrubBreadcrumb({
      category: "navigation",
      message: "to /join/abc",
      data: { from: "/", to: "/auth/reset-password?token=r1" },
    });
    expect(JSON.stringify(crumb)).not.toMatch(/abc|r1/);
    expect(crumb.category).toBe("navigation");
  });

  it("scrubs event message, exception, request, spans and breadcrumbs", () => {
    const event = scrubEvent({
      message: "failed for bob@x.io",
      exception: { values: [{ type: "Error", value: "Bearer tkn" }] },
      request: { url: "https://app.test/join/abc" },
      transaction: "GET /join/abc",
      spans: [{ description: "GET https://s3.test/a?X-Amz-Signature=sig1" }],
      breadcrumbs: [{ message: "/api?state=s1" }],
      release: "a".repeat(40),
    });
    const text = JSON.stringify(event);
    for (const secret of ["bob@x.io", "tkn", "/join/abc", "sig1", 's1"'])
      expect(text).not.toContain(secret);
    expect(event.release).toBe("a".repeat(40));
  });

  it("scrubs log messages and attributes", () => {
    const log = scrubLog({
      level: "error",
      message: "delivery to https://hooks.slack.com/services/T/B/S failed",
      attributes: { url: "/join/abc", count: 2 },
    });
    expect(log.message).not.toContain("/T/B/S");
    expect(log.attributes).toEqual({ url: `/join/${FILTERED}`, count: 2 });
  });

  it("drops the item when scrubbing throws", () => {
    const hook = failClosed<{ message: string }>(() => {
      throw new Error("boom");
    });
    expect(hook({ message: "x" })).toBeNull();
  });
});
