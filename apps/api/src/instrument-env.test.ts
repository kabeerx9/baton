import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vite-plus/test";

const INSTRUMENT = resolve(__dirname, "instrument.ts");
const TSX = import.meta.resolve("tsx");
const SENTRY = import.meta.resolve("@sentry/node");

// The child runs in an empty temp folder whose .env is the only source of
// SENTRY_DSN, pointed at a local fake ingest. Nothing leaves the machine,
// and the developer's own root .env is never read.
async function runInstrument(nodeEnv: string) {
  const server = createServer((request, response) => {
    request.resume();
    response.writeHead(200).end("{}");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const cwd = await mkdtemp(join(tmpdir(), "baton-instrument-"));
  try {
    await writeFile(
      join(cwd, ".env"),
      `SENTRY_DSN=http://public@127.0.0.1:${address.port}/1\n`,
    );
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: nodeEnv };
    delete env.SENTRY_DSN;
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        "--import",
        TSX,
        "--import",
        INSTRUMENT,
        "--input-type=module",
        "-e",
        `const S = await import(${JSON.stringify(SENTRY)}); console.log(S.isInitialized()); await S.close(500);`,
      ],
      { cwd, env, timeout: 30_000 },
    );
    return stdout.trim().split("\n").at(-1);
  } finally {
    server.close();
    await rm(cwd, { recursive: true, force: true });
  }
}

it("turns Sentry on in dev from a DSN that only the root .env sets", async () => {
  expect(await runInstrument("development")).toBe("true");
});

it("reads no .env file in production", async () => {
  expect(await runInstrument("production")).toBe("false");
});
