import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vite-plus/test";
import { createLogger } from "./logger";
import { currentRequestContext } from "./request-context";
import { requestContext } from "./request-context-middleware";
import { acceptRequestId } from "./request-id";
import { setRequestUser, setWorkspaceContext } from "./workspace-context";

function harness() {
  const lines: Record<string, unknown>[] = [];
  const log = createLogger({
    level: "debug",
    pretty: false,
    write: (line) => lines.push(JSON.parse(line)),
    sentry: { enabled: () => false, log: () => {}, capture: () => {} },
  });
  const app = new Hono<{ Variables: { workspaceId?: string } }>();
  app.use("*", requestContext(log));
  app.onError((err) =>
    err instanceof HTTPException
      ? err.getResponse()
      : new Response("x", { status: 500 }),
  );
  app.get("/api/health", (c) => c.text("ok"));
  app.get("/api/task/:taskId", async (c) => {
    const user = c.req.query("user") ?? "";
    const workspace = c.req.query("ws") ?? "";
    setRequestUser(user);
    await new Promise((r) => setTimeout(r, Number(c.req.query("wait") ?? 0)));
    setWorkspaceContext(c, workspace);
    await new Promise((r) => setTimeout(r, Number(c.req.query("wait") ?? 0)));
    log.info("handled", { taskId: c.req.param("taskId") });
    return c.json({
      context: currentRequestContext(),
      workspaceId: c.get("workspaceId"),
    });
  });
  app.get("/api/missing", () => {
    throw new HTTPException(404, { message: "nope" });
  });
  app.get("/api/crash", () => {
    throw new Error("crash");
  });
  return { app, lines };
}

describe("acceptRequestId", () => {
  it("keeps a safe incoming id", () => {
    expect(acceptRequestId("abc-1234_5678.9:0")).toBe("abc-1234_5678.9:0");
  });

  it.each([
    ["missing", undefined],
    ["too short", "abc"],
    ["log injection", 'abcdefgh","level":"error'],
    ["newline", "abcdefgh\nfake"],
    ["too long", "a".repeat(65)],
  ])("replaces a %s id", (_name, incoming) => {
    const id = acceptRequestId(incoming);
    expect(id).not.toBe(incoming);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("requestContext middleware", () => {
  it("returns the request id and logs it on every line", async () => {
    const { app, lines } = harness();
    const res = await app.request("/api/task/t1?user=u1&ws=w1", {
      headers: { "X-Request-Id": "client-req-0001" },
    });
    expect(res.headers.get("X-Request-Id")).toBe("client-req-0001");
    expect(lines.map((l) => l.request_id)).toEqual([
      "client-req-0001",
      "client-req-0001",
    ]);
  });

  it("generates an id when the incoming one is unsafe", async () => {
    const { app } = harness();
    const res = await app.request("/api/task/t1", {
      headers: { "X-Request-Id": "bad id" },
    });
    expect(res.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("writes one access line with the route pattern, not the raw path", async () => {
    const { app, lines } = harness();
    await app.request("/api/task/secret-task-id?user=u1&ws=w1");
    const access = lines.at(-1);
    expect(access).toMatchObject({
      level: "info",
      msg: "request",
      method: "GET",
      route: "/api/task/:taskId",
      status: 200,
      workspace_id: "w1",
      user_id: "u1",
    });
    expect(typeof access?.duration_ms).toBe("number");
    expect(JSON.stringify(access)).not.toContain("secret-task-id");
  });

  it("logs 4xx at info and 5xx at error", async () => {
    const { app, lines } = harness();
    await app.request("/api/missing");
    await app.request("/api/crash");
    expect(lines.map((l) => [l.status, l.level])).toEqual([
      [404, "info"],
      [500, "error"],
    ]);
  });

  it("skips health probes", async () => {
    const { app, lines } = harness();
    const res = await app.request("/api/health");
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
    expect(lines).toHaveLength(0);
  });

  it("never mixes context between interleaved requests", async () => {
    const { app, lines } = harness();
    const runs = Array.from({ length: 20 }, (_, i) =>
      app.request(`/api/task/t${i}?user=u${i}&ws=w${i}&wait=${(i * 7) % 5}`, {
        headers: { "X-Request-Id": `request-${String(i).padStart(4, "0")}` },
      }),
    );
    const bodies = await Promise.all(runs.map(async (r) => (await r).json()));
    bodies.forEach((body, i) => {
      expect(body.context).toEqual({
        requestId: `request-${String(i).padStart(4, "0")}`,
        userId: `u${i}`,
        workspaceId: `w${i}`,
      });
      expect(body.workspaceId).toBe(`w${i}`);
    });
    for (const line of lines) {
      const i = Number(String(line.request_id).slice(-4));
      expect(line).toMatchObject({ user_id: `u${i}`, workspace_id: `w${i}` });
    }
    expect(lines).toHaveLength(40);
  });
});
