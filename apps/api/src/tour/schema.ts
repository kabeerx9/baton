import { z } from "../openapi";
import { DEMO_TASK_KEYS } from "./demo/demo-tasks";

const demoWorkspaceRef = z.object({
  id: z.string(),
  slug: z.string(),
});

export const tourStatusSchema = z
  .object({
    completed: z.boolean().openapi({
      description:
        "True after the caller finished or skipped the tour. False means the web app shows it.",
    }),
    demoWorkspace: demoWorkspaceRef.nullable().openapi({
      description:
        "The caller's demo workspace, if one exists. It is never listed with the other workspaces.",
    }),
  })
  .openapi("TourStatus");

export const demoTaskKeySchema = z.enum(DEMO_TASK_KEYS).openapi("DemoTaskKey");

export const tourStartSchema = z
  .object({
    demoWorkspace: demoWorkspaceRef
      .extend({
        projectId: z.string().openapi({
          description: "The project that holds the demo tasks.",
        }),
      })
      .openapi({ description: "The fresh demo workspace." }),
    tasks: z
      .array(
        z.object({
          key: demoTaskKeySchema,
          id: z.string(),
          number: z.number().int().optional(),
        }),
      )
      .openapi({ description: "The seeded demo tasks, by tour key." }),
  })
  .openapi("TourStart");

export const tourFinishBody = z
  .object({
    outcome: z.enum(["finished", "skipped"]).openapi({
      description: "Whether the caller reached the end or skipped the tour.",
    }),
  })
  .openapi("TourFinishRequest");

export const tourFinishSchema = z
  .object({ completed: z.literal(true) })
  .openapi("TourFinish");

export const tourReplaySchema = z
  .object({ completed: z.literal(false) })
  .openapi("TourReplay");
