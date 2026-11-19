import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vite-plus/test";

const RENDERER = resolve(import.meta.dirname, "../env.awk");

function renderBundle(
  bundle: string,
  key = "",
  extra: Record<string, string> = {},
) {
  return execFileSync("awk", ["-f", RENDERER], {
    input: bundle,
    encoding: "utf8",
    env: {
      ...process.env,
      BATON_TURNSTILE_SITE_KEY: key,
      BATON_API_URL: "https://api.example.test",
      BATON_CLIENT_URL: "https://app.example.test",
      BATON_SENTRY_DSN: "",
      BATON_SENTRY_ENVIRONMENT: "",
      ...extra,
    },
  });
}

const SENTRY_BUNDLE =
  'globalThis.dsn = "BATON_SENTRY_DSN"; globalThis.env = "BATON_SENTRY_ENVIRONMENT";';

function renderSentry(dsn: string, environment = "") {
  const context: { dsn?: string; env?: string } = {};
  runInNewContext(
    renderBundle(SENTRY_BUNDLE, "", {
      BATON_SENTRY_DSN: dsn,
      BATON_SENTRY_ENVIRONMENT: environment,
    }),
    context,
  );
  return context;
}

const DSN = "https://abc123def456@o123.ingest.us.sentry.io/4507654321";
describe("runtime environment replacement", () => {
  it("clears unset optional placeholders for every emitted literal quote", () => {
    const rendered = renderBundle(
      "globalThis.values = [\"BATON_TURNSTILE_SITE_KEY\", 'BATON_TURNSTILE_SITE_KEY', `BATON_TURNSTILE_SITE_KEY`, 'https://example.test'];",
    );
    const context: { values?: string[] } = {};
    runInNewContext(rendered, context);
    expect(context.values).toEqual(["", "", "", "https://example.test"]);
  });
  it("encodes configured punctuation as literal data rather than JavaScript", () => {
    const key = '";globalThis.injected=true;//\\\n`';
    const context: { value?: string; injected?: boolean } = {};
    runInNewContext(
      renderBundle('globalThis.value = "BATON_TURNSTILE_SITE_KEY";', key),
      context,
    );
    expect(context.value).toBe(key);
    expect(context.injected).toBeUndefined();
  });

  it("writes a valid Sentry DSN and environment into the bundle", () => {
    expect(renderSentry(DSN, "production")).toEqual({
      dsn: DSN,
      env: "production",
    });
  });

  it("accepts a self-hosted DSN with a port and path prefix", () => {
    const dsn = "https://key1@sentry.example.test:9443/sentry/7";
    expect(renderSentry(dsn).dsn).toBe(dsn);
  });

  it("renders empty Sentry values when unset, which keeps Sentry off", () => {
    expect(renderSentry("")).toEqual({ dsn: "", env: "" });
  });

  it.each([
    ["plain http", "http://abc@o1.ingest.sentry.io/1"],
    ["no public key", "https://o1.ingest.sentry.io/1"],
    ["no project id", "https://abc@o1.ingest.sentry.io/"],
    ["script injection", 'https://abc@o1.test/1";globalThis.injected=1;//'],
    ["query string", "https://abc@o1.test/1?x=1"],
    ["secret key form", "https://abc:secret@o1.test/1"],
    ["placeholder", "BATON_SENTRY_DSN"],
  ])("renders an invalid DSN (%s) empty", (_name, dsn) => {
    const context = renderSentry(dsn) as { dsn?: string; injected?: unknown };
    expect(context.dsn).toBe("");
    expect(context.injected).toBeUndefined();
  });

  it("ignores an environment name with unsafe characters", () => {
    expect(renderSentry(DSN, "prod uction").env).toBe("");
    expect(renderSentry(DSN, "a".repeat(65)).env).toBe("");
  });

  it("leaves a Sentry placeholder with a path suffix untouched", () => {
    const rendered = renderBundle('x = "BATON_SENTRY_DSN/extra";', "", {
      BATON_SENTRY_DSN: DSN,
    });
    expect(rendered).toBe('x = "BATON_SENTRY_DSN/extra";\n');
  });

  it("warns once at startup about an invalid DSN, without printing it", () => {
    const output = execFileSync("awk", ["-v", "mode=check", "-f", RENDERER], {
      input: "",
      encoding: "utf8",
      env: { ...process.env, BATON_SENTRY_DSN: "http://leaky@host/1" },
    });
    expect(output).toContain("BATON_SENTRY_DSN is not an https Sentry DSN");
    expect(output).not.toContain("leaky");
  });

  it("prints nothing at startup when Sentry values are valid or unset", () => {
    const check = (env: Record<string, string>) =>
      execFileSync("awk", ["-v", "mode=check", "-f", RENDERER], {
        input: "",
        encoding: "utf8",
        env: { ...process.env, ...env },
      });
    expect(check({ BATON_SENTRY_DSN: DSN })).toBe("");
    expect(check({ BATON_SENTRY_DSN: "" })).toBe("");
  });
});
