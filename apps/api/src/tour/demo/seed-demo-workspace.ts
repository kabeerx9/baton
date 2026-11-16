import { DEFAULT_ROLE_NAMES, defaultRolePayloads } from "@baton/permissions";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  columnTable,
  projectTable,
  taskRelationTable,
  taskTable,
  workspaceRoleTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import type { OutboxTransaction } from "../../events/outbox/consumer";
import { seedDefaultColumns } from "../../project/controllers/insert-project";
import claimTaskNumbers from "../../task/controllers/claim-task-numbers";
import { nextTaskPosition } from "../../task/controllers/next-task-position";
import { DEMO_TASKS, type DemoTaskKey } from "./demo-tasks";

export type SeededDemo = {
  demoWorkspace: { id: string; slug: string; projectId: string };
  tasks: { key: DemoTaskKey; id: string; number: number }[];
};

/**
 * Creates one user's demo workspace in the caller's transaction: the
 * workspace, its owner membership and default roles, the hidden board
 * project with the default columns, and the demo tasks with their links.
 * The rows match what the real create paths write. It publishes no event,
 * so seeding reaches no subscriber, integration or provider.
 */
export async function seedDemoWorkspace(
  tx: OutboxTransaction,
  userId: string,
): Promise<SeededDemo> {
  const now = new Date();
  const [workspace] = await tx
    .insert(workspaceTable)
    .values({
      name: "Baton tour",
      slug: `tour-${createId()}`,
      description: "A practice board for the product tour. Only you see it.",
      createdAt: now,
      kind: "demo",
      demoOwnerUserId: userId,
    })
    .returning({ id: workspaceTable.id, slug: workspaceTable.slug });
  if (!workspace) throw new HTTPException(500, { message: "Not created" });

  await tx.insert(workspaceUserTable).values({
    workspaceId: workspace.id,
    userId,
    role: "owner",
    joinedAt: now,
  });
  await tx.insert(workspaceRoleTable).values(
    DEFAULT_ROLE_NAMES.map((role) => ({
      workspaceId: workspace.id,
      role,
      permission: JSON.stringify(defaultRolePayloads[role]),
      createdAt: now,
      updatedAt: now,
    })),
  );

  // The hidden board project, as ensureBoardProject creates it.
  const [project] = await tx
    .insert(projectTable)
    .values({
      workspaceId: workspace.id,
      name: "Board",
      icon: "SquareKanban",
      slug: "T",
      position: 0,
      kind: "board",
    })
    .returning({ id: projectTable.id });
  if (!project) throw new HTTPException(500, { message: "Not created" });
  await seedDefaultColumns(tx, project.id);
  const columns = await tx
    .select({ id: columnTable.id, slug: columnTable.slug })
    .from(columnTable)
    .where(eq(columnTable.projectId, project.id));
  const columnId = new Map(columns.map((column) => [column.slug, column.id]));

  const firstNumber = await claimTaskNumbers(project.id, DEMO_TASKS.length, tx);
  const tasks: SeededDemo["tasks"] = [];
  for (const [index, demo] of DEMO_TASKS.entries()) {
    const column = columnId.get(demo.status) ?? null;
    const [task] = await tx
      .insert(taskTable)
      .values({
        projectId: project.id,
        userId,
        createdBy: userId,
        title: demo.title,
        description: demo.description,
        status: demo.status,
        columnId: column,
        priority: "no-priority",
        number: firstNumber + index,
        position: await nextTaskPosition(tx, project.id, demo.status, column),
      })
      .returning({ id: taskTable.id, number: taskTable.number });
    if (!task) throw new HTTPException(500, { message: "Not created" });
    tasks.push({ key: demo.key, id: task.id, number: task.number ?? 0 });
  }

  const idOf = new Map(tasks.map((task) => [task.key, task.id]));
  const links = DEMO_TASKS.flatMap((demo) =>
    demo.waitsOn.map((blocker) => ({
      // "Waits on" is stored as `blocks`: source = the blocker.
      sourceTaskId: idOf.get(blocker)!,
      targetTaskId: idOf.get(demo.key)!,
      relationType: "blocks",
    })),
  );
  if (links.length) await tx.insert(taskRelationTable).values(links);

  return {
    demoWorkspace: {
      id: workspace.id,
      slug: workspace.slug,
      projectId: project.id,
    },
    tasks,
  };
}
