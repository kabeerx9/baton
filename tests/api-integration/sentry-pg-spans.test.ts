import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vite-plus/test";

const API = resolve(__dirname, "../../apps/api");
const SECRET = "Confidential acquisition plan";

type Span = {
  name?: string;
  status?: string;
  attributes?: Record<string, { value?: unknown } | undefined>;
};

/** Runs `script` in a child against a local fake ingest; returns the spans. */
async function runChild(script: string, preload: boolean) {
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
    response.writeHead(200).end("{}");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  try {
    await promisify(execFile)(
      process.execPath,
      [
        "--import",
        "tsx",
        ...(preload ? ["--import", "./src/instrument.ts"] : []),
        "--input-type=module",
        "-e",
        script,
      ],
      {
        cwd: API,
        timeout: 60_000,
        env: {
          ...process.env,
          // Production reads no .env file; the DSN is the local fake.
          NODE_ENV: "production",
          SENTRY_DSN: `http://public@127.0.0.1:${address.port}/1`,
          SENTRY_TRACES_SAMPLE_RATE: "1",
          SECRET,
        },
      },
    );
  } finally {
    server.close();
  }
  const spans: Span[] = [];
  for (const envelope of envelopes) {
    const lines = envelope.split("\n").filter(Boolean).slice(1);
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const header = JSON.parse(lines[i] ?? "{}");
      if (header.type !== "span") continue;
      spans.push(...(JSON.parse(lines[i + 1] ?? "{}").items ?? []));
    }
  }
  return { spans, raw: envelopes.join("\n") };
}

// Queries made inside one root span: one that works, one that pg rejects
// with the task value in its error message.
const QUERIES = `
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await Sentry.startSpan({ name: 'probe' }, async () => {
    await pool.query('select 1');
    await pool.query('select $1::uuid', [process.env.SECRET]).catch(() => {});
  });
  await pool.end();
  await Sentry.flush(5000);
`;

// The same test as the scrubber's: a db op or a db.system attribute.
const isDbSpan = (span: Span) =>
  String(span.attributes?.["sentry.op"]?.value ?? "").startsWith("db") ||
  span.attributes?.["db.system"] !== undefined ||
  span.attributes?.["db.system.name"] !== undefined;

it("sends pg spans when instrument.ts is preloaded", async () => {
  const { spans } = await runChild(
    `const Sentry = await import('@sentry/node');
     if (!Sentry.isInitialized()) throw new Error('no Sentry');
     ${QUERIES}`,
    true,
  );
  // pg must load after Sentry.init, or it is never patched.
  expect(spans.filter(isDbSpan).length).toBeGreaterThanOrEqual(2);
  expect(spans.some((s) => s.name === "probe")).toBe(true);
});

it("keeps only allowlisted fields on database spans", async () => {
  // Sentry starts first and pg loads after it, whatever the privacy hooks
  // import; the real hook is swapped in before any span ends.
  const { spans, raw } = await runChild(
    `const Sentry = await import('@sentry/node');
     let hook = () => { throw new Error('hook not loaded'); };
     Sentry.init({
       dsn: process.env.SENTRY_DSN,
       tracesSampleRate: 1,
       beforeSendSpan: (span) => hook(span),
     });
     const { privacyOptions } = await import('./src/observability/sentry-options.ts');
     hook = privacyOptions.beforeSendSpan;
     ${QUERIES}`,
    false,
  );
  const db = spans.filter(isDbSpan);
  // The failing query's span exists and is an error, so the test is live.
  const failed = db.find((s) => s.status === "error");
  expect(failed).toBeDefined();
  expect(raw).not.toContain(SECRET);
  expect(failed?.attributes?.["sentry.status.message"]?.value).toBe(
    "database error",
  );
  // Driver facts beyond the allowlist are gone; the statement stays.
  for (const span of db)
    for (const key of [
      "db.connection_string",
      "db.user",
      "db.postgresql.max.client",
    ])
      expect(span.attributes?.[key], key).toBeUndefined();
  expect(
    db.some(
      (s) => s.attributes?.["db.query.text"]?.value === "select $1::uuid",
    ),
  ).toBe(true);
  // The SDK's own attributes stay, so the trace view still works.
  expect(failed?.attributes?.["sentry.segment.id"]).toBeDefined();
});
