import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import { seedDefaultColumns } from "../../project/controllers/insert-project";
import { lockProjectOrdering } from "../../project/controllers/project-placement";
import { findProjectKeyConflict } from "../../project/project-key";

const SLUGS = ["T", "TASK", "TASKS"];

const boardProject = (workspaceId: string) =>
  and(
    eq(projectTable.workspaceId, workspaceId),
    eq(projectTable.kind, "board"),
  );

/**
 * Each workspace keeps its tasks as top-level tasks of one hidden project.
 * Returns that project, creating it the first time the workspace needs it.
 * The workspace lock makes two first requests agree on one project.
 */
export async function ensureBoardProject(workspaceId: string) {
  const columns = { id: projectTable.id, slug: projectTable.slug };
  const [existing] = await db
    .select(columns)
    .from(projectTable)
    .where(boardProject(workspaceId))
    .limit(1);
  if (existing) return existing;

  return db.transaction(async (tx) => {
    await lockProjectOrdering(tx, workspaceId);
    const [raced] = await tx
      .select(columns)
      .from(projectTable)
      .where(boardProject(workspaceId))
      .limit(1);
    if (raced) return raced;

    let slug: string | undefined;
    for (const candidate of SLUGS) {
      if (!(await findProjectKeyConflict(tx, workspaceId, candidate))) {
        slug = candidate;
        break;
      }
    }
    if (!slug) {
      throw new HTTPException(409, {
        message: "No free key for the board. Rename the repo that uses T.",
      });
    }

    const [created] = await tx
      .insert(projectTable)
      .values({
        workspaceId,
        name: "Board",
        icon: "SquareKanban",
        slug,
        position: 0,
        kind: "board",
      })
      .returning(columns);
    if (!created) throw new HTTPException(500, { message: "Not created" });
    await seedDefaultColumns(tx, created.id);
    return created;
  });
}
