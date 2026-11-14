import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";
import { hiddenBlockersSchema, waitsOnSchema } from "../task/response";

const assigneeSchema = z
  .object({ id: z.string(), name: z.string(), image: z.string().nullable() })
  .nullable()
  .openapi("BoardAssignee");

const pullRequestSchema = z
  .object({
    number: z.number(),
    url: z.string(),
    state: z.enum(["open", "closed", "merged"]),
  })
  .openapi("BoardPullRequest");

const boardTaskBaseSchema = z.object({
  id: z.string(),
  number: z.number().nullable(),
  key: z.string().openapi({
    description: "Repo prefix and number, for example API-3 or T-5.",
  }),
  title: z.string(),
  status: z.string(),
  isCompleted: z.boolean(),
  priority: z.string().nullable(),
  projectId: z.string(),
  assignee: assigneeSchema,
  dueDate: nullableResponseTimestamp.openapi({
    description: "The item's own due date. Not derived for a feature.",
  }),
  finishedAt: nullableResponseTimestamp.openapi({
    description:
      "When the item reached done, the same time team history shows. For a feature, when its last task finished, set only while its column is done. Null while open.",
  }),
  waitsOn: waitsOnSchema,
  hiddenBlockers: hiddenBlockersSchema,
});

export const subtaskSchema = boardTaskBaseSchema
  .extend({
    pullRequests: z.array(pullRequestSchema),
    blockedBy: z.array(z.string()).openapi({
      description:
        "IDs of visible subtasks that block this one, whatever their status. Edges for the feature map only, not a blocked signal: read `waitsOn` and `hiddenBlockers` for that.",
    }),
  })
  .openapi("BoardSubtask");

export const boardTaskSchema = boardTaskBaseSchema
  .extend({
    description: z.string().nullable(),
    column: z.enum(["todo", "doing", "review", "done"]).openapi({
      description:
        "Where the task sits on the board. Its own status when it has no subtasks. A feature is done when all its tasks are done, review when every unfinished task is in review, doing once any has started, otherwise todo. A blocked item stays in its column.",
    }),
    subtasks: z.array(subtaskSchema),
  })
  .openapi("BoardTask");

export const boardProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    icon: z.string().nullable(),
    kind: z.enum(["repo", "board"]).openapi({
      description:
        "`repo` projects hold subtasks. The single `board` project holds the tasks themselves and is not a subtask target.",
    }),
    repository: z.string().nullable().openapi({
      description: "owner/name of the connected GitHub repository, if any.",
    }),
  })
  .openapi("BoardRepoProject");

export const boardSchema = z
  .object({
    tasks: z.array(boardTaskSchema),
    members: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          image: z.string().nullable(),
        }),
      )
      .openapi({
        description:
          "Everyone in the workspace. Use an id here as the userId when you assign work.",
      }),
    projects: z.array(boardProjectSchema).openapi({
      description:
        "Every project in the workspace the caller can see, for labelling subtasks and offering repo choices.",
    }),
  })
  .openapi("TaskBoard");

export const teamHistorySchema = z
  .object({
    since: responseTimestamp,
    days: z.number(),
    totalDone: z.number(),
    people: z.array(
      z.object({
        user: z.object({
          id: z.string(),
          name: z.string(),
          image: z.string().nullable(),
        }),
        done: z.number().openapi({
          description:
            "Finished units of work in the window. A unit is a subtask, or a board task with no subtasks.",
        }),
        open: z.number().openapi({
          description: "Open work assigned to this person right now.",
        }),
        byRepo: z.array(
          z.object({
            projectId: z.string(),
            name: z.string(),
            count: z.number(),
          }),
        ),
        recent: z.array(
          z.object({
            id: z.string(),
            key: z.string(),
            title: z.string(),
            projectId: z.string(),
            finishedAt: responseTimestamp,
          }),
        ),
      }),
    ),
  })
  .openapi("TeamHistory");
