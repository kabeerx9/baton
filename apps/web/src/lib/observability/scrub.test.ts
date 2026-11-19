import { defaultStackParser } from "@sentry/react";
import { describe, expect, it } from "vite-plus/test";
import {
  FILTERED,
  failClosed,
  scrubBreadcrumb,
  scrubDeep,
  scrubEvent,
  scrubLog,
  scrubSpan,
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

  it("replaces values under secret keys and route parameter attributes", () => {
    const out = scrubDeep({
      token: "short",
      "params.token": "JOINTOKEN",
      "url.path.parameter.token": "JOINTOKEN",
      "params.inviteId": "inv1",
      "url.query.code": "c1",
      headers: { Authorization: "x", cookie: "y" },
      "params.workspaceId": "ws1",
      state: "accepted",
      code: "ECONNREFUSED",
    });
    expect(out).toEqual({
      token: FILTERED,
      "params.token": FILTERED,
      "url.path.parameter.token": FILTERED,
      "params.inviteId": FILTERED,
      "url.query.code": FILTERED,
      headers: { Authorization: FILTERED, cookie: FILTERED },
      "params.workspaceId": "ws1",
      state: "accepted",
      code: "ECONNREFUSED",
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

  it("scrubs stack frame files and source context, keeping positions", () => {
    // The real parser turns a page URL in the stack into frame filenames.
    const frames = defaultStackParser(
      "Error: boom\n    at render (https://app.test/assets/index-abc.js:10:5)\n    at https://app.test/join/shortSecret:1:2",
    ).map((frame) => ({
      ...frame,
      context_line: "const link = '/join/ctxSecret';",
      pre_context: ["fetch('/api?token=preSecret')"],
      post_context: ["mail('carol@x.io')"],
      vars: { url: "/join/varSecret", password: "hunter2", count: 3 },
    }));
    expect(JSON.stringify(frames)).toContain("shortSecret");
    const event = scrubEvent({
      exception: {
        values: [{ type: "Error", value: "boom", stacktrace: { frames } }],
      },
      threads: { values: [{ stacktrace: { frames } }] },
    });
    const text = JSON.stringify(event);
    for (const secret of [
      "shortSecret",
      "ctxSecret",
      "preSecret",
      "carol@x.io",
      "varSecret",
      "hunter2",
    ])
      expect(text).not.toContain(secret);
    const scrubbed = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
    expect(
      scrubbed.map(({ function: fn, lineno, colno, in_app }) => ({
        fn,
        lineno,
        colno,
        in_app,
      })),
    ).toEqual(
      frames.map(({ function: fn, lineno, colno, in_app }) => ({
        fn,
        lineno,
        colno,
        in_app,
      })),
    );
    expect(scrubbed.some((f) => f.filename?.endsWith("index-abc.js"))).toBe(
      true,
    );
  });

  it("filters database values in error text and fields", () => {
    const message =
      "Failed query: insert into task (title) values ($1)\nparams: Secret plan,\nline two";
    expect(scrubText(message)).toBe(
      `Failed query: insert into task (title) values ($1)\nparams: ${FILTERED}`,
    );
    const stack = `Error: ${message}\n    at run (/app/x.js:1:2)`;
    expect(scrubText(stack)).toBe(
      `Error: Failed query: insert into task (title) values ($1)\nparams: ${FILTERED}\n    at run (/app/x.js:1:2)`,
    );
    expect(
      scrubDeep({
        params: ["Secret plan"],
        detail: "Failing row contains (Secret plan)",
        where: "x",
        code: "23502",
      }),
    ).toEqual({
      params: FILTERED,
      detail: FILTERED,
      where: FILTERED,
      code: "23502",
    });
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

describe("scrubSpan", () => {
  it("scrubs the span name and URL attributes", () => {
    const span = scrubSpan({
      name: "GET /join/abcSecret",
      span_id: "1",
      attributes: {
        "url.full": "https://app.test/join/abcSecret?token=t9",
        "http.response.status_code": 200,
      },
    });
    expect(JSON.stringify(span)).not.toMatch(/abcSecret|t9/);
    expect(span.attributes?.["http.response.status_code"]).toBe(200);
    expect(span.span_id).toBe("1");
  });

  it("keeps only ids and timing when scrubbing throws", () => {
    const attributes = {};
    Object.defineProperty(attributes, "boom", {
      enumerable: true,
      get() {
        throw new Error("boom");
      },
    });
    const span = scrubSpan({ name: "/join/x", span_id: "1", attributes });
    expect(span).toEqual({ name: FILTERED, span_id: "1", attributes: {} });
  });
});
