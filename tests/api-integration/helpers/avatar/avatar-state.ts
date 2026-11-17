import { eq, sql } from "drizzle-orm";
import { expect } from "vite-plus/test";
import db, { schema } from "../../../../apps/api/src/database";
import { buildAvatarUrl } from "../../../../apps/api/src/user/avatar";

export const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]).toString("base64");
export const PNG_UPLOAD = { contentType: "image/png", data: PNG };

export async function avatarState(userId: string) {
  const [user] = await db
    .select({ image: schema.userTable.image })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  const rows = await db
    .select({ id: schema.userAvatarTable.id })
    .from(schema.userAvatarTable)
    .where(eq(schema.userAvatarTable.userId, userId));
  return { image: user?.image ?? null, rowIds: rows.map((row) => row.id) };
}

/** `user.image` points at the stored row, or both are empty. No orphan rows. */
export async function expectAvatarInSync(userId: string) {
  const { image, rowIds } = await avatarState(userId);
  if (rowIds[0]) expect(image).toBe(buildAvatarUrl(rowIds[0]));
  else expect(image).toBeNull();
  return { image, rowIds };
}

/** Make every statement matching `when` on `table` fail until removed. */
export async function injectFailure(
  table: "user" | "admin_audit_log",
  when: "BEFORE UPDATE OF image" | "BEFORE INSERT",
) {
  await db.execute(
    sql.raw(`CREATE OR REPLACE FUNCTION avatar_test_fail() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$`),
  );
  await db.execute(
    sql.raw(`CREATE TRIGGER avatar_test_fail ${when} ON "${table}"
      FOR EACH ROW EXECUTE FUNCTION avatar_test_fail()`),
  );
  return async () => {
    await db.execute(
      sql.raw(`DROP TRIGGER IF EXISTS avatar_test_fail ON "${table}"`),
    );
    await db.execute(sql.raw("DROP FUNCTION IF EXISTS avatar_test_fail()"));
  };
}

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** "pending" when `promise` has not settled within `ms`. */
export async function settlesWithin(promise: Promise<unknown>, ms = 300) {
  return Promise.race([
    promise.then(() => "settled" as const),
    new Promise<"pending">((done) => setTimeout(() => done("pending"), ms)),
  ]);
}
