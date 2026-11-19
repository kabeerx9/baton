import { HTTPException } from "hono/http-exception";
import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

export const projectSchema = z
  .object({
    includeSubtasks: z.boolean().optional(),
    kind: z.string().optional().openapi({
      description:
        "`repo` for a normal project, `board` for the workspace's hidden board project.",
    }),
    id: z.string(),
    workspaceId: z.string(),
    backgroundVersion: z.string().nullable(),
    slug: z.string().openapi({
      description: "Short prefix used in task identifiers, e.g. KAN-12.",
    }),
    icon: z.string().nullable(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: responseTimestamp,
    archivedAt: nullableResponseTimestamp.openapi({
      description:
        "Non-null once archived; archived projects are hidden by default.",
    }),
    position: z.number().openapi({ description: "Sidebar order, ascending." }),
    lastTaskNumber: z.number().openapi({
      description:
        "Highest task number issued in this project; the next task gets this plus one.",
    }),
  })
  .openapi("Project");

export const projectStatisticsSchema = z
  .object({
    completionPercentage: z.number(),
    totalTasks: z.number(),
    dueDate: nullableResponseTimestamp.openapi({
      description: "The soonest due date among the project's open tasks.",
    }),
  })
  .openapi("ProjectStatistics");

export const projectListItemSchema = projectSchema
  .extend({
    statistics: projectStatisticsSchema,
  })
  .openapi("ProjectListItem");

export const projectListSchema = z.array(projectListItemSchema);

export const projectBackgroundUploadSchema = z
  .object({
    key: z.string(),
    uploadUrl: z.string(),
    version: z.string(),
    headers: z.record(z.string(), z.string()),
  })
  .openapi("ProjectBackgroundUpload");

export const projectBackgroundFinalizeSchema = z
  .object({ url: z.string() })
  .openapi("ProjectBackgroundFinalize");
export const movedProjectSchema = projectSchema
  .extend({ unassignedTaskCount: z.number() })
  .openapi("MovedProject");

// Storage coordinates are private implementation details, even on mutations
// that return a full database row. Preserve each endpoint's other fields.
export function toPublicProject<
  T extends {
    backgroundObjectKey: string | null;
    backgroundMimeType: string | null;
  },
>(project: T | undefined) {
  if (!project)
    throw new HTTPException(500, {
      message: "Project mutation returned no result",
    });
  const {
    backgroundObjectKey: _key,
    backgroundMimeType: _mime,
    ...publicProject
  } = project;
  return publicProject;
}
