import { z } from "../openapi";

export const taskIdParam = z.object({ taskId: z.string() });

export const commentParam = z.object({ id: z.string() });

export const createCommentBody = z.object({
  content: z.string().min(1).max(10_000),
});

export const updateCommentBody = z.object({
  content: z.string().min(1).max(10_000),
});
