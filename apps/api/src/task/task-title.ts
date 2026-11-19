import { z } from "../openapi";

export const TASK_TITLE_MAX_LENGTH = 500;

/** Every task title a client sends: trimmed, not blank, at most 500 characters. */
export const taskTitle = z
  .string()
  .trim()
  .min(1, "Title cannot be empty")
  .max(
    TASK_TITLE_MAX_LENGTH,
    `Title must be ${TASK_TITLE_MAX_LENGTH} characters or fewer`,
  )
  .openapi({
    description: `Trimmed. Blank, or more than ${TASK_TITLE_MAX_LENGTH} characters after the trim, is 400.`,
    minLength: 1,
    maxLength: TASK_TITLE_MAX_LENGTH,
  });
