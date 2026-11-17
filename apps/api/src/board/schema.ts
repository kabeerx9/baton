import { z } from "../openapi";

export const boardWorkspaceParam = z.object({ workspaceId: z.string() });

export const boardQuery = z.object({
  doneSince: z.iso.datetime({ offset: true }).optional().openapi({
    description:
      "Done items that finished before this ISO datetime are left out and counted in `olderDoneCount`. The web app sends its local midnight minus 14 days. Defaults to now minus 14 days; a future value is clamped to now; an old value returns more history.",
  }),
});

export const teamHistoryQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().openapi({
    description: "How many days back to count finished work. Defaults to 30.",
  }),
});

const subtaskPlan = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  repo: z.string().optional().openapi({
    description:
      "Repo key or name, for example API. Leave out, or send `none`, for work with no repo such as QA or design.",
  }),
  owner: z.string().optional().openapi({
    description: "A person's first name, full name, email or user id.",
  }),
  status: z.string().optional(),
  waitsOn: z
    .array(z.union([z.string(), z.number().int().min(1)]))
    .optional()
    .openapi({
      description:
        "What must be finished first. Each entry is a ticket key (API-3), the title of another subtask in this request, or its position (1 is the first).",
    }),
});

export const taskPlanBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  owner: z.string().optional().openapi({
    description: "A person's first name, full name, email or user id.",
  }),
  subtasks: z.array(subtaskPlan).max(50).optional(),
});

export const boardKeyParam = z.object({
  workspaceId: z.string(),
  key: z.string().min(1).openapi({
    description: "A ticket key such as API-3, or the task's id.",
  }),
});

export const addSubtaskPlansBody = z.object({
  subtasks: z.array(subtaskPlan).min(1).max(50),
});

export const updateByKeyBody = z.object({
  status: z.string().optional().openapi({
    description:
      "A column slug, or an everyday word: todo, in progress, review, done.",
  }),
  owner: z.string().nullable().optional().openapi({
    description: "A person, or null to remove the owner.",
  }),
  waitsOn: z.array(z.string()).max(20).optional().openapi({
    description: "Ticket keys of tasks that must be finished first.",
  }),
});

export const createBoardTaskBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  userId: z.string().optional().openapi({
    description:
      "Assignee. A task with an assignee and no subtasks is a plain task.",
  }),
});

export const boardTaskIdParam = z.object({ taskId: z.string() });

export const addSubtaskBody = z.object({
  projectId: z.string().openapi({
    description:
      "Where the subtask lives: a repo project (for example the API project), or the board project itself for work with no repo such as QA or design.",
  }),
  title: z.string().min(1),
  description: z.string().optional(),
  userId: z.string().optional().openapi({ description: "Assignee, if any." }),
  status: z
    .string()
    .optional()
    .openapi({ description: "Target column slug. Defaults to `to-do`." }),
  priority: z
    .enum(["no-priority", "low", "medium", "high", "urgent"])
    .optional(),
});
