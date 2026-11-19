import { describe, expect, it } from "vite-plus/test";
import { resolveSentryConfig } from "./sentry-config";

const DSN = "https://abc@o1.ingest.sentry.io/1";

describe("resolveSentryConfig", () => {
  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["unrendered placeholder", "BATON_SENTRY_DSN"],
    ["plain http", "http://abc@o1.ingest.sentry.io/1"],
    ["not a URL", "nonsense"],
  ])("stays off when the DSN is %s", (_name, dsn) => {
    expect(resolveSentryConfig(dsn, "production", "production")).toBeNull();
  });

  it("uses the rendered environment", () => {
    expect(resolveSentryConfig(DSN, "staging", "production")).toEqual({
      dsn: DSN,
      environment: "staging",
    });
  });

  it("falls back when the environment is empty or unrendered", () => {
    expect(resolveSentryConfig(DSN, "", "production")?.environment).toBe(
      "production",
    );
    expect(
      resolveSentryConfig(DSN, "BATON_SENTRY_ENVIRONMENT", "production")
        ?.environment,
    ).toBe("production");
  });

  it("allows a local http DSN for development smoke tests", () => {
    expect(
      resolveSentryConfig("http://key@localhost:9999/1", "", "development"),
    ).not.toBeNull();
  });
});
