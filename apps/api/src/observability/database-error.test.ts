import { DrizzleQueryError } from "drizzle-orm/errors";
import { DatabaseError } from "pg";
import { describe, expect, it } from "vite-plus/test";
import {
  isDatabaseError,
  serializeDatabaseError,
  stackFrames,
} from "./database-error";

function pgError(message: string, fields: Record<string, string>) {
  const error = new DatabaseError(message, message.length, "error");
  return Object.assign(error, { severity: "ERROR", ...fields });
}

describe("serializeDatabaseError", () => {
  it("keeps schema facts and drops pg's message, detail, where and hint", () => {
    const error = pgError('invalid input syntax for type uuid: "secret"', {
      code: "22P02",
      detail: "secret detail",
      where: "secret where",
      hint: "secret hint",
      internalQuery: "select 'secret'",
      routine: "string_to_uuid",
    });
    const out = serializeDatabaseError(error);
    expect(JSON.stringify(out)).not.toContain("secret");
    expect(out).toMatchObject({
      name: "error",
      message: "Database error (pg 22P02 invalid_text_representation)",
      code: "22P02",
      routine: "string_to_uuid",
    });
  });

  it("keeps the SQL and the cause's facts, not the params", () => {
    const cause = pgError("null value", {
      code: "23502",
      table: "task",
      column: "project_id",
      routine: "ExecConstraints",
    });
    const error = new DrizzleQueryError(
      'insert into "task" ("title") values ($1)',
      ["secret title"],
      cause,
    );
    const out = serializeDatabaseError(error);
    expect(JSON.stringify(out)).not.toContain("secret");
    expect(out).toMatchObject({
      message: "Failed query (pg 23502 not_null_violation on task.project_id)",
      query: 'insert into "task" ("title") values ($1)',
      code: "23502",
    });
    expect(out.stack).toMatch(/^Error: Failed query \(pg 23502 .*\)\n {4}at /);
  });

  it("drops a stack that does not start with the error's own header", () => {
    const error = pgError("bad value secret", { code: "22P02", routine: "x" });
    // V8 formats the stack on first read; a later message change no
    // longer matches it.
    expect(error.stack).toContain("bad value secret");
    error.message = "changed after the stack was made";
    expect(stackFrames(error)).toBeUndefined();
    expect(serializeDatabaseError(error).stack).toBeUndefined();
  });

  it("leaves other errors to the generic path", () => {
    expect(isDatabaseError(new Error("x"))).toBe(false);
    expect(
      isDatabaseError(Object.assign(new Error("x"), { code: "ECONNREFUSED" })),
    ).toBe(false);
  });
});
