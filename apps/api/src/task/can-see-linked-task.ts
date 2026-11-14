import { sql } from "drizzle-orm";
import { projectTable } from "../database/schema";
import { projectAccessCondition } from "../project-access/project-access-condition";

/**
 * True when the caller may see a linked task whose `projectTable` row is in
 * scope. The board lists every top-level board task to every workspace
 * member, so the hidden board project is always visible; a repo follows
 * project access. Callers still check the workspace.
 */
export function canSeeLinkedTask(userId: string) {
  return sql<boolean>`(${projectTable.kind} = 'board' or ${projectAccessCondition(userId, projectTable.id)})`;
}
