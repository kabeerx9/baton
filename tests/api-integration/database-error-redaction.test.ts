import * as Sentry from "@sentry/node";
import { sql } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { DatabaseError } from "pg";
import { afterAll, beforeAll, beforeEach, expect, it } from "vite-plus/test";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { buildLogRecord } from "../../apps/api/src/observability/log-record";
import { privacyOptions } from "../../apps/api/src/observability/sentry-options";
import { resetTestDatabase } from "./helpers/database";
import { outboxTaskFixture } from "./helpers/outbox";

// A value shaped like a stack frame: a text rule that stops at
// "\n    at " would let the rest through.
const SECRET = "Confidential acquisition plan";
const TITLE = `Meeting\n    at noon discuss ${SECRET}`;
const LEAKS = [SECRET, "noon"];
const NOT_NULL = "(pg 23502 not_null_violation on task.project_id)";
const events: Sentry.ErrorEvent[] = [];

beforeAll(() => {
  // No transport reaches a server: the test keeps what beforeSend returns.
  Sentry.init({
    dsn: "https://public@sentry.invalid/1",
    defaultIntegrations: false,
    // Linked errors sends the pg cause; extra error data copies its fields.
    integrations: [
      Sentry.linkedErrorsIntegration(),
      Sentry.extraErrorDataIntegration({ depth: 4 }),
    ],
    beforeSend: (event, hint) => {
      const scrubbed = privacyOptions.beforeSend(event, hint);
      if (scrubbed) events.push(scrubbed);
      return null;
    },
  });
});

afterAll(async () => {
  await Sentry.close();
});

beforeEach(async () => {
  events.length = 0;
  await resetTestDatabase();
});

async function caught(work: PromiseLike<unknown>): Promise<unknown> {
  try {
    await work;
  } catch (error) {
    return error;
  }
  throw new Error("the query did not fail");
}

/** A real failed task insert: the title is a query value and in pg's detail. */
async function failedTitleInsert(): Promise<DrizzleQueryError> {
  const { user, columns } = await outboxTaskFixture();
  const error = await caught(
    db.insert(schema.taskTable).values({
      // A not-null failure: pg's detail then shows the whole row.
      projectId: null as never,
      columnId: columns.todo.id,
      title: TITLE,
      position: 1,
      createdBy: user.id,
    }),
  );
  if (!(error instanceof DrizzleQueryError)) throw new Error("no query error");
  return error;
}

function expectNoLeak(value: unknown) {
  const text = JSON.stringify(value);
  for (const leak of LEAKS) expect(text).not.toContain(leak);
}

/** One log record for `error`, as logger.error would build it. */
function logRecord(error: unknown) {
  return buildLogRecord(
    "error",
    "Query failed",
    { error, nested: { error } },
    undefined,
    new Date(),
  );
}

it("logs a failed insert with a multiline value as schema facts only", async () => {
  const error = await failedTitleInsert();
  // The test is only meaningful if the error carries the value.
  expect(error.message).toContain(TITLE);
  expect(error.stack).toContain(TITLE);
  expect(JSON.stringify(error.cause)).toContain(SECRET);

  const record = logRecord(error);
  expectNoLeak(record);
  const logged = record.error as Record<string, unknown>;
  expect(logged).toMatchObject({
    message: `Failed query ${NOT_NULL}`,
    code: "23502",
    table: "task",
    column: "project_id",
    cause: { name: "error", message: `Database error ${NOT_NULL}` },
  });
  // The SQL keeps its $n placeholders; the frames keep the real call sites.
  expect(logged.query).toMatch(/^insert into "task" .*\$1/);
  expect(String(logged.stack)).toMatch(
    /^Error: Failed query \(pg 23502 .*\)\n {4}at /,
  );
  expect(String(logged.stack)).toContain("failedTitleInsert");
});

it("sends a failed insert with a multiline value to Sentry without it", async () => {
  Sentry.captureException(await failedTitleInsert());
  await Sentry.flush(1000);

  expect(events).toHaveLength(1);
  const event = events[0]!;
  expectNoLeak(event);
  // Both errors of the chain reach Sentry, cause first, with real frames.
  const values = event.exception?.values ?? [];
  expect(values.map((v) => [v.type, v.value])).toEqual([
    ["error", `Database error ${NOT_NULL}`],
    ["Error", `Failed query ${NOT_NULL}`],
  ]);
  const frames = values.at(-1)?.stacktrace?.frames ?? [];
  expect(frames.some((f) => f.function?.includes("failedTitleInsert"))).toBe(
    true,
  );
  expect(frames.every((f) => typeof f.lineno === "number")).toBe(true);
});

it("keeps a uuid syntax error's value out of logs and Sentry", async () => {
  // pg puts the rejected input in the message itself.
  const raw = await caught(getDatabasePool().query("select $1::uuid", [TITLE]));
  const wrapped = await caught(db.execute(sql`select ${TITLE}::uuid`));
  expect(raw).toBeInstanceOf(DatabaseError);
  expect(wrapped).toBeInstanceOf(DrizzleQueryError);
  expect((raw as Error).message).toContain(SECRET);

  const rawRecord = logRecord(raw);
  const wrappedRecord = logRecord(wrapped);
  expectNoLeak([rawRecord, wrappedRecord]);
  expect(rawRecord.error).toMatchObject({
    name: "error",
    message: "Database error (pg 22P02 invalid_text_representation)",
    code: "22P02",
  });
  expect(wrappedRecord.error).toMatchObject({
    message: "Failed query (pg 22P02 invalid_text_representation)",
  });

  Sentry.captureException(raw);
  Sentry.captureException(wrapped);
  await Sentry.flush(1000);
  expect(events).toHaveLength(2);
  expectNoLeak(events);
  expect(events.map((e) => e.exception?.values?.at(-1)?.value)).toEqual([
    "Database error (pg 22P02 invalid_text_representation)",
    "Failed query (pg 22P02 invalid_text_representation)",
  ]);
});

it("filters an exception value that matches no error in the chain", async () => {
  const error = await failedTitleInsert();
  // A processor that changed a value breaks the exact match: fail closed.
  const event = privacyOptions.beforeSend(
    {
      type: undefined,
      exception: { values: [{ type: "Error", value: `copied ${TITLE}` }] },
    },
    { originalException: error },
  );
  expectNoLeak(event);
  expect(event?.exception?.values?.[0]?.value).toBe("[Filtered]");
});
