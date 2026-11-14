import { sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type db from "../database";

type Tx = Pick<typeof db, "execute">;

/**
 * Refuses a "blocks" link that would close a loop of any length, such as
 * A > B > C > A. Rule 5 would then stop every task in the loop from being
 * finished. The walk follows every blocks link, whatever the caller can see,
 * so the message names no task.
 *
 * Takes a transaction-scoped lock per workspace first, so two requests that
 * each close half of a loop cannot both pass the check.
 */
export async function assertNoBlocksCycle(
  tx: Tx,
  workspaceId: string,
  blockerId: string,
  blockedId: string,
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`task-relation-blocks:${workspaceId}`}))`,
  );
  // Everything that already blocks the new blocker, directly or through
  // others. `union` drops repeats, so an old loop in the data still ends.
  const result = await tx.execute(sql`
    with recursive upstream(id) as (
      select source_task_id from task_relation
      where relation_type = 'blocks' and target_task_id = ${blockerId}
      union
      select r.source_task_id from task_relation r
      inner join upstream u on r.target_task_id = u.id
      where r.relation_type = 'blocks'
    )
    select 1 as found from upstream where id = ${blockedId} limit 1
  `);
  if (result.rows.length > 0) {
    throw new HTTPException(409, {
      message:
        "This link would create a loop: the blocking task already waits, directly or through other tasks, on the task it would block.",
    });
  }
}
