import * as Sentry from "@sentry/node";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { buildLogRecord } from "../../apps/api/src/observability/log-record";
import { privacyOptions } from "../../apps/api/src/observability/sentry-options";
import { resetTestDatabase } from "./helpers/database";
import { outboxTaskFixture } from "./helpers/outbox";

const TITLE = "Confidential acquisition plan";
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

/** A real failed task insert: the title is a query value and in pg's detail. */
async function failedTitleInsert(): Promise<DrizzleQueryError> {
  const { user, columns } = await outboxTaskFixture();
  const error = await db
    .insert(schema.taskTable)
    .values({
      // A not-null failure: pg's detail then shows the whole row.
      projectId: null as never,
      columnId: columns.todo.id,
      title: TITLE,
      position: 1,
      createdBy: user.id,
    })
    .then(
      () => null,
      (caught: unknown) => caught,
    );
  if (!(error instanceof DrizzleQueryError)) throw new Error("no query error");
  return error;
}

it("keeps query values out of the log record, cause included", async () => {
  const error = await failedTitleInsert();
  // The test is only meaningful if the error carries the title.
  expect(error.message).toContain(TITLE);
  expect(JSON.stringify((error as { cause?: unknown }).cause)).toContain(TITLE);

  const record = buildLogRecord(
    "error",
    "Task insert failed",
    { error, nested: { error } },
    undefined,
    new Date(),
  );
  const text = JSON.stringify(record);
  expect(text).not.toContain(TITLE);
  // What helps debugging stays: the query and the pg message and code.
  expect(text).toContain("Failed query: insert into");
  expect(text).toContain("params: [Filtered]");
  expect(text).toContain("23502");
});

it("keeps query values out of the Sentry event, cause included", async () => {
  const error = await failedTitleInsert();
  Sentry.captureException(error);
  await Sentry.flush(1000);

  expect(events).toHaveLength(1);
  const event = events[0]!;
  expect(JSON.stringify(event)).not.toContain(TITLE);
  // Both errors of the chain reach Sentry, with frames intact.
  // (Drizzle leaves the name as "Error"; pg's error is "error".)
  expect(event.exception?.values?.map((v) => v.type)).toEqual([
    "error",
    "Error",
  ]);
  const top = event.exception?.values?.at(-1);
  expect(top?.value).toContain("params: [Filtered]");
  expect(top?.stacktrace?.frames?.length).toBeGreaterThan(0);
});
