import type { TFunction } from "i18next";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { heldText } from "./held-text";
import { finishBlock, taskKey } from "./task-facts";

/** Why a task's done control is locked, in words. Null when the task can be finished. */
export function finishBlockText(
  t: TFunction,
  task: AssignedTask,
): { label: string; detail: string } | null {
  const block = finishBlock(task);
  if (!block) return null;
  const label = t("workspace:myTasks.row.cannotFinish", { key: taskKey(task) });
  if (block === "feature") {
    return { label, detail: t("workspace:myTasks.row.featureHint") };
  }
  return { label, detail: heldText(t, task)?.detail ?? "" };
}
