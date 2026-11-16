import { sql } from "drizzle-orm";
import { outboxTable } from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { eventContext } from "../context";
import { type ConsumerName, OUTBOX_ROUTES, type Scope } from "./routes";

export type OutboxEvent = { type: string; data: unknown };

type Row = typeof outboxTable.$inferInsert;

function workspaceOf(scope: Scope) {
  if ("workspaceId" in scope) return scope.workspaceId;
  // A project that no longer exists yields NULL, and the NOT NULL column
  // fails the insert: a row never exists without its tenant.
  return sql`(SELECT "workspace_id" FROM "project" WHERE "id" = ${scope.projectId})`;
}

/** The rows one event produces: one per durable consumer that wants it. */
export function outboxRows({ type, data }: OutboxEvent): Row[] {
  const route = OUTBOX_ROUTES[type];
  if (!route || typeof data !== "object" || data === null) return [];
  const pickers = Object.entries(route.consumers) as Array<
    [ConsumerName, (data: unknown) => Record<string, unknown> | null]
  >;
  const rows: Array<Omit<Row, "workspaceId">> = [];
  for (const [consumer, pick] of pickers) {
    const payload = pick(data);
    if (payload) rows.push({ type, consumer, payload });
  }
  if (!rows.length) return [];
  const scope = route.scope(data as Record<string, unknown>);
  if (!scope) throw new OutboxScopeError(type);
  const store = eventContext.getStore();
  return rows.map((row) => ({
    ...row,
    workspaceId: workspaceOf(scope) as string,
    initiatorId: store?.initiatorId ?? null,
    channel: store?.channel ?? null,
  }));
}

/**
 * Writes the outbox rows for several events in one statement. Pass the
 * domain transaction so the rows commit or roll back with the change.
 */
export async function enqueueEvents(
  database: DbOrTx,
  events: OutboxEvent[],
): Promise<number> {
  const rows = events.flatMap(outboxRows);
  if (!rows.length) return 0;
  await database.insert(outboxTable).values(rows);
  return rows.length;
}

export function enqueueEvent(database: DbOrTx, type: string, data: unknown) {
  return enqueueEvents(database, [{ type, data }]);
}

export class OutboxScopeError extends Error {
  constructor(type: string) {
    super(`Outbox event ${type} has no workspace or project`);
    this.name = "OutboxScopeError";
  }
}
