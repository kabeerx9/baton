import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vite-plus/test";

type Item = { type?: string } & Record<string, unknown>;

/** Splits Sentry envelopes into [header, payload] items. */
function items(envelopes: string[]): Item[] {
  const out: Item[] = [];
  for (const envelope of envelopes) {
    const lines = envelope.split("\n").filter(Boolean).slice(1);
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const header = JSON.parse(lines[i] ?? "{}");
      out.push({ type: header.type, ...JSON.parse(lines[i + 1] ?? "{}") });
    }
  }
  return out;
}

// Runs the real instrument.ts, Hono app wiring and Sentry SDK in a child
// process against a local fake ingest. Nothing leaves the machine.
it("reports 5xx once, skips 4xx, and keeps user and workspace per request", async () => {
  const envelopes: string[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    envelopes.push(
      (request.headers["content-encoding"] === "gzip"
        ? gunzipSync(bytes)
        : bytes
      ).toString(),
    );
    response.writeHead(200, { "content-type": "application/json" }).end("{}");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    await promisify(execFile)(
      process.execPath,
      [
        "--import",
        "tsx",
        "--import",
        "./src/instrument.ts",
        "--input-type=module",
        "-e",
        `
      const Sentry = await import('@sentry/node');
      const { Hono } = await import('hono');
      const { HTTPException } = await import('hono/http-exception');
      const { requestContext } = await import('./src/observability/request-context-middleware.ts');
      const { reportRequestError } = await import('./src/observability/report-error.ts');
      const { setRequestUser, setWorkspaceContext } = await import('./src/observability/workspace-context.ts');
      const { logger } = await import('./src/observability/logger.ts');
      if (!Sentry.isInitialized()) throw new Error('instrument.ts did not init Sentry');
      const app = new Hono();
      app.use('*', requestContext());
      app.onError((err) => { reportRequestError(err); return new Response('x', { status: err.status ?? 500 }); });
      const pause = (ms) => new Promise((r) => setTimeout(r, ms));
      app.get('/api/:kind/:n', async (c) => {
        const n = Number(c.req.param('n'));
        setRequestUser('user-' + n);
        await pause((n * 7) % 5);
        setWorkspaceContext(c, 'ws-' + n);
        await pause((n * 3) % 4);
        Sentry.addBreadcrumb({ category: 'test', message: 'visit /join/JOIN_SECRET_' + n });
        const kind = c.req.param('kind');
        if (kind === 'missing') throw new HTTPException(404, { message: 'missing-' + n });
        if (kind === 'unavailable') throw new HTTPException(503, { message: 'unavailable-' + n });
        if (kind === 'logged') { logger.error('logged-' + n, { error: new Error('logged-error-' + n) }); throw new Error('after-log-' + n); }
        throw new Error('crash-' + n);
      });
      const kinds = ['crash', 'missing', 'unavailable', 'logged'];
      await Promise.all(Array.from({ length: 16 }, (_, n) => app.request('/api/' + kinds[n % 4] + '/' + n)));
      await Sentry.close(5000);
    `,
      ],
      {
        cwd: resolve(import.meta.dirname, "../.."),
        env: {
          ...process.env,
          NODE_ENV: "production",
          LOG_LEVEL: "error",
          SENTRY_DSN: `${base.replace("://", "://public@")}/1`,
          SENTRY_TRACES_SAMPLE_RATE: "0",
          SENTRY_PROFILES_SAMPLE_RATE: "0",
        },
        timeout: 20000,
      },
    );

    const all = items(envelopes);
    const events = all.filter((item) => item.type === "event") as Array<{
      exception?: { values?: Array<{ value?: string }> };
      user?: { id?: string; email?: string; ip_address?: string };
      tags?: Record<string, string>;
      breadcrumbs?: Array<{ message?: string }>;
    }>;
    const messages = events.map(
      (e) => e.exception?.values?.at(-1)?.value ?? "",
    );

    // 4xx HTTPExceptions are expected refusals: never reported.
    expect(messages.filter((m) => m.startsWith("missing-"))).toEqual([]);
    // Each 5xx and each crash is reported exactly once.
    for (let n = 0; n < 16; n++) {
      const kind = ["crash", "missing", "unavailable", "logged"][n % 4];
      if (kind === "missing") continue;
      const expected =
        kind === "logged"
          ? [`logged-error-${n}`, `after-log-${n}`]
          : [`${kind}-${n}`];
      for (const message of expected)
        expect(
          messages.filter((m) => m === message),
          message,
        ).toHaveLength(1);
    }
    expect(events).toHaveLength(16);

    // Scope belongs to the request that raised the error: no bleed.
    for (const [index, event] of events.entries()) {
      const n = Number(messages[index]?.split("-").at(-1));
      expect(event.user).toEqual({ id: `user-${n}` });
      expect(event.tags?.workspace_id).toBe(`ws-${n}`);
      const crumbs = (event.breadcrumbs ?? []).map((b) => b.message ?? "");
      expect(crumbs.filter((m) => m.startsWith("visit"))).toHaveLength(1);
    }

    const telemetry = envelopes.join("\n");
    expect(telemetry).not.toContain("JOIN_SECRET");
    // The error log line went to Sentry Logs as well, scrubbed and tagged.
    const logs = all.filter((item) => item.type === "log");
    expect(JSON.stringify(logs)).toContain("logged-3");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
}, 30000);
