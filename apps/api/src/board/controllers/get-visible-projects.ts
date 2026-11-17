import { and, asc, eq, isNull } from "drizzle-orm";
import { integrationTable, projectTable } from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { parseRepository } from "./parse-repository";

export type VisibleProject = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  kind: "repo" | "board";
  repository: string | null;
};

/** The workspace's active projects the caller can see, with their GitHub repo. */
export async function getVisibleProjects(
  database: DbOrTx,
  workspaceId: string,
  userId: string,
): Promise<VisibleProject[]> {
  const rows = await database
    .select({
      id: projectTable.id,
      name: projectTable.name,
      slug: projectTable.slug,
      icon: projectTable.icon,
      kind: projectTable.kind,
      integrationType: integrationTable.type,
      integrationConfig: integrationTable.config,
    })
    .from(projectTable)
    .leftJoin(
      integrationTable,
      and(
        eq(integrationTable.projectId, projectTable.id),
        eq(integrationTable.type, "github"),
        eq(integrationTable.isActive, true),
      ),
    )
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNull(projectTable.archivedAt),
        projectAccessCondition(userId, projectTable.id),
      ),
    )
    .orderBy(asc(projectTable.position));

  const byId = new Map<string, VisibleProject>();
  for (const r of rows) {
    const existing = byId.get(r.id);
    const repository = r.integrationConfig
      ? parseRepository(r.integrationConfig)
      : null;
    if (existing) {
      existing.repository ??= repository;
      continue;
    }
    byId.set(r.id, {
      id: r.id,
      name: r.name,
      slug: r.slug,
      icon: r.icon,
      kind: r.kind === "board" ? "board" : "repo",
      repository,
    });
  }
  return [...byId.values()];
}
