import { describe, expect, it, vi } from "vite-plus/test";
import { isEnabled, parseLogLevel } from "./log-level";
import { formatPretty } from "./log-record";
import { createLogger, type SentryBridge } from "./logger";
import { runWithRequestContext } from "./request-context";

const NOW = new Date("2026-11-19T10:00:00.000Z");

function setup(
  options: {
    level?: "debug" | "info" | "warn" | "error";
    sentryOn?: boolean;
  } = {},
) {
  const lines: string[] = [];
  const sentry = {
    enabled: vi.fn(() => options.sentryOn ?? true),
    log: vi.fn(),
    capture: vi.fn(),
  } satisfies SentryBridge;
  const log = createLogger({
    level: options.level ?? "debug",
    pretty: false,
    write: (line) => lines.push(line),
    sentry,
    now: () => NOW,
  });
  const records = () => lines.map((line) => JSON.parse(line));
  return { log, lines, records, sentry };
}

describe("parseLogLevel", () => {
  it("uses LOG_LEVEL when valid, else info in production and debug elsewhere", () => {
    expect(parseLogLevel("WARN", "production")).toBe("warn");
    expect(parseLogLevel("verbose", "production")).toBe("info");
    expect(parseLogLevel(undefined, "production")).toBe("info");
    expect(parseLogLevel(undefined, "development")).toBe("debug");
  });

  it("orders levels", () => {
    expect(isEnabled("error", "warn")).toBe(true);
    expect(isEnabled("info", "warn")).toBe(false);
  });
});

describe("logger", () => {
  it("writes one JSON line with ts, level, msg and attributes", () => {
    const { log, lines, records } = setup();
    log.info("task moved", { taskId: "t1", count: 2 });
    expect(lines).toHaveLength(1);
    expect(records()[0]).toEqual({
      ts: NOW.toISOString(),
      level: "info",
      msg: "task moved",
      taskId: "t1",
      count: 2,
    });
  });

  it("drops lines below the threshold", () => {
    const { log, lines } = setup({ level: "warn", sentryOn: false });
    log.debug("d");
    log.info("i");
    log.warn("w");
    expect(lines.map((l) => JSON.parse(l).level)).toEqual(["warn"]);
  });

  it("adds request id, workspace and user from the request context", () => {
    const { log, records } = setup();
    runWithRequestContext(
      { requestId: "req-12345678", workspaceId: "ws1", userId: "u1" },
      () => log.info("inside"),
    );
    expect(records()[0]).toMatchObject({
      request_id: "req-12345678",
      workspace_id: "ws1",
      user_id: "u1",
    });
  });

  it("does not let attributes overwrite the reserved fields", () => {
    const { log, records } = setup();
    log.info("real", { msg: "fake", level: "error", ts: "x" });
    expect(records()[0]).toMatchObject({
      msg: "real",
      level: "info",
      ts: NOW.toISOString(),
    });
  });

  it("scrubs the message and attributes", () => {
    const { log, lines, sentry } = setup();
    log.warn("join /join/secretTok failed for a@b.io", {
      url: "https://x.test/cb?code=c1",
      headers: { authorization: "Bearer tok1" },
    });
    for (const secret of ["secretTok", "a@b.io", "c1", "tok1"])
      expect(lines[0]).not.toContain(secret);
    expect(JSON.stringify(sentry.log.mock.calls)).not.toMatch(/secretTok|tok1/);
  });

  it("serializes an Error attribute with name, message and stack", () => {
    const { log, records } = setup({ sentryOn: false });
    const error = new TypeError("bad input");
    log.error("failed", { error });
    expect(records()[0].error).toMatchObject({
      name: "TypeError",
      message: "bad input",
      stack: expect.stringContaining("TypeError: bad input"),
    });
  });

  it("survives circular and bigint attributes", () => {
    const { log, records } = setup();
    const loop: Record<string, unknown> = { n: 1n };
    loop.self = loop;
    log.info("odd", { loop });
    expect(records()[0].loop).toEqual({ n: "1", self: "[Truncated]" });
  });

  it("forwards warn and error to Sentry Logs, not info or debug", () => {
    const { log, sentry } = setup();
    log.debug("d");
    log.info("i");
    log.warn("w", { a: 1 });
    log.error("e");
    expect(sentry.log.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ["warn", "w"],
      ["error", "e"],
    ]);
    expect(sentry.log.mock.calls[0]?.[2]).toEqual({ a: 1 });
  });

  it("forwards info only when the call asks, and never when told not to", () => {
    const { log, sentry } = setup();
    log.info("domain", {}, { sentry: true });
    log.error("access", {}, { sentry: false });
    expect(sentry.log.mock.calls.map((c) => c[1])).toEqual(["domain"]);
  });

  it("sends info to Sentry even when stdout filters it out", () => {
    const { log, lines, sentry } = setup({ level: "error" });
    log.info("domain", {}, { sentry: true });
    expect(lines).toHaveLength(0);
    expect(sentry.log).toHaveBeenCalledTimes(1);
  });

  it("captures an Error once on error level only", () => {
    const { log, sentry } = setup();
    const error = new Error("boom");
    log.warn("warned", { error });
    log.error("failed", { error });
    log.error("no error attribute", { code: "X" });
    expect(sentry.capture).toHaveBeenCalledTimes(1);
    expect(sentry.capture).toHaveBeenCalledWith(error);
  });

  it("does nothing with Sentry when it is off", () => {
    const { log, sentry } = setup({ sentryOn: false });
    log.error("failed", { error: new Error("x") });
    expect(sentry.log).not.toHaveBeenCalled();
    expect(sentry.capture).not.toHaveBeenCalled();
  });

  it("nests Sentry attributes as JSON text", () => {
    const { log, sentry } = setup();
    log.warn("w", { facts: { a: 1 } });
    expect(sentry.log.mock.calls[0]?.[2]).toEqual({ facts: '{"a":1}' });
  });

  it("never throws, even when writing fails", () => {
    const log = createLogger({
      level: "debug",
      pretty: false,
      write: () => {
        throw new Error("stdout closed");
      },
      sentry: { enabled: () => false, log: () => {}, capture: () => {} },
    });
    expect(() => log.error("x")).not.toThrow();
  });

  it("formats a readable line for development", () => {
    expect(
      formatPretty({
        ts: NOW.toISOString(),
        level: "warn",
        msg: "slow",
        ms: 12,
        route: "/api/x",
      }),
    ).toBe("10:00:00.000 WARN  slow ms=12 route=/api/x");
  });
});
