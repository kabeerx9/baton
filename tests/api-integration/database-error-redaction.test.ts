import * as Sentry from "@sentry/node";
import { sql } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { DatabaseError } from "pg";
import { defaultStackParser } from "@sentry/node";
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
const MAX_VALUE = 70;
const events: Sentry.ErrorEvent[] = [];

beforeAll(() => {
  // No transport reaches a server: the test keeps what beforeSend returns.
  Sentry.init({
    dsn: "https://public@sentry.invalid/1",
    defaultIntegrations: false,
    // Short enough that the SDK truncates a Drizzle message (collision test).
    maxValueLength: MAX_VALUE,
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

it("replaces an SDK value it cannot trust with the chain's own", async () => {
  const error = await failedTitleInsert();
  // A processor that changed a value: nothing of it is kept.
  const event = privacyOptions.beforeSend(
    {
      type: undefined,
      exception: { values: [{ type: "Error", value: `copied ${TITLE}` }] },
    },
    { originalException: error },
  );
  expectNoLeak(event);
  expect(event?.exception?.values?.map((v) => v.value)).toEqual([
    `Database error ${NOT_NULL}`,
    `Failed query ${NOT_NULL}`,
  ]);
});

// Round 3: nothing the SDK produced for a database error event survives.

async function captured(error: unknown, scope?: (s: Sentry.Scope) => void) {
  Sentry.withScope((s) => {
    scope?.(s);
    Sentry.captureException(error);
  });
  await Sentry.flush(1000);
  expect(events).toHaveLength(1);
  return events[0]!;
}

it("keeps no SDK frame when a truncated value equals a wrapper's message", async () => {
  const error = await failedTitleInsert();
  // The SDK's own parse of the stack turns the value into frames.
  expect(JSON.stringify(defaultStackParser(error.stack ?? ""))).toContain(
    SECRET,
  );
  // The SDK cuts both values to MAX_VALUE + "...": the Drizzle one then
  // equals this wrapper's message exactly.
  const wrapper = new Error(`${error.message.slice(0, MAX_VALUE)}...`, {
    cause: error,
  });
  const event = await captured(wrapper);
  expectNoLeak(event);
  expect(event.exception?.values?.map((v) => v.value)).toEqual([
    `Database error ${NOT_NULL}`,
    `Failed query ${NOT_NULL}`,
    "Error (wraps a database error)",
  ]);
});

it("keeps no SDK frame when a processor removed the value", async () => {
  const event = await captured(await failedTitleInsert(), (scope) =>
    scope.addEventProcessor((e) => {
      for (const value of e.exception?.values ?? []) delete value.value;
      return e;
    }),
  );
  expectNoLeak(event);
  expect(event.exception?.values?.at(-1)?.value).toBe(
    `Failed query ${NOT_NULL}`,
  );
});

it("drops the stack when the message was shortened after the stack was made", async () => {
  const error = await failedTitleInsert();
  expect(error.stack).toContain(SECRET);
  // Cut inside the value: the old stack still holds the rest of it.
  error.message = error.message.slice(0, error.message.indexOf("noon") + 2);
  const record = logRecord(error);
  expectNoLeak(record);
  expect((record.error as { stack?: string }).stack).toBeUndefined();
  expectNoLeak(await captured(error));
});

it("replaces the message of a wrapper that copies a database message", async () => {
  const cause = await failedTitleInsert();
  const wrapper = new Error(`write failed: ${cause.message}`, { cause });
  const record = logRecord(wrapper);
  expectNoLeak(record);
  expect(record.error).toMatchObject({
    name: "Error",
    message: "Error (wraps a database error)",
    cause: { message: `Failed query ${NOT_NULL}` },
  });
  expect(String((record.error as { stack?: string }).stack)).toMatch(
    /^Error: Error \(wraps a database error\)\n {4}at /,
  );
  const event = await captured(wrapper);
  expectNoLeak(event);
  expect(event.exception?.values?.at(-1)?.value).toBe(
    "Error (wraps a database error)",
  );
});

it("redacts an AggregateError that groups a database error", async () => {
  const error = await failedTitleInsert();
  const group = new AggregateError([error], `batch failed: ${error.message}`);
  const record = logRecord(group);
  expectNoLeak(record);
  expect(record.error).toMatchObject({
    message: "AggregateError (wraps a database error)",
    errors: [{ message: `Failed query ${NOT_NULL}` }],
  });
  const event = await captured(group, (scope) =>
    scope.addBreadcrumb({ message: `saw ${error.message}` }),
  );
  expectNoLeak(event);
  expect(event.exception?.values?.at(-1)).toMatchObject({
    type: "AggregateError",
    value: "AggregateError (wraps a database error)",
    mechanism: { is_exception_group: true },
  });
});

// Round 4: no walk limit or text comparison decides what is safe.

it("redacts a database error ten wrappers deep", async () => {
  const error = await failedTitleInsert();
  let top: Error = error;
  for (let i = 0; i < 10; i++)
    top = new Error(`level ${i}: ${error.message}`, { cause: top });
  const record = logRecord(top);
  expectNoLeak(record);
  expect(record.error).toMatchObject({
    message: "Error (wraps a database error)",
  });
  expectNoLeak(await captured(top));
});

it("redacts a database error behind many AggregateError siblings", async () => {
  const error = await failedTitleInsert();
  const siblings = Array.from({ length: 12 }, (_, i) => new Error(`ok ${i}`));
  const group = new AggregateError(
    [...siblings, error],
    `batch: ${error.message}`,
  );
  expectNoLeak(logRecord(group));
  expectNoLeak(await captured(group));
});

it("treats a chain it cannot walk as sensitive", async () => {
  const error = new Error(`write failed: ${TITLE}`);
  Object.defineProperty(error, "cause", {
    get() {
      throw new Error("no cause for you");
    },
  });
  const record = logRecord(error);
  expectNoLeak(record);
  expect(record.error).toMatchObject({
    message: "Error (may wrap a database error)",
  });
  // The SDK's own cause walk throws too, so it may send nothing at all:
  // either way, nothing it sends holds the value.
  Sentry.captureException(error);
  await Sentry.flush(1000);
  expectNoLeak(events);
});

it("keeps only allowlisted contexts and request breadcrumbs", async () => {
  const error = await failedTitleInsert();
  const event = await captured(error, (scope) => {
    // A console breadcrumb holds the raw message, quotes and newlines too.
    scope.addBreadcrumb({ category: "console", message: error.message });
    scope.addBreadcrumb({
      category: "http",
      message: `GET ${TITLE}`,
      data: { method: "GET", status_code: 500, url: "/api/task", body: TITLE },
    });
    scope.setContext("task", { title: TITLE });
    scope.setExtra("note", TITLE);
  });
  expectNoLeak(event);
  expect(event.extra).toBeUndefined();
  expect(event.message).toBeUndefined();
  for (const key of Object.keys(event.contexts ?? {}))
    expect([
      "os",
      "runtime",
      "app",
      "device",
      "culture",
      "trace",
      "cloud_resource",
    ]).toContain(key);
  expect(
    event.breadcrumbs?.map((c) => [c.category, c.message, c.data]),
  ).toEqual([
    ["http", undefined, { method: "GET", status_code: 500, url: "/api/task" }],
  ]);
});
