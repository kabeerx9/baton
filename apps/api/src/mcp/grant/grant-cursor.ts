/** Grant ids are cuid2 values; anything else never names a grant. */
const GRANT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Keyset position in the grant list: created_at desc, then id desc. */
export type GrantCursor = { createdAt: Date; id: string };

export function encodeGrantCursor(cursor: GrantCursor): string {
  return Buffer.from(
    JSON.stringify([cursor.createdAt.toISOString(), cursor.id]),
  ).toString("base64url");
}

/** Returns null for anything that is not a cursor this API issued. */
export function decodeGrantCursor(value: string): GrantCursor | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 2 ||
      typeof parsed[0] !== "string" ||
      typeof parsed[1] !== "string" ||
      !GRANT_ID.test(parsed[1])
    )
      return null;
    const createdAt = new Date(parsed[0]);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: parsed[1] };
  } catch {
    return null;
  }
}
