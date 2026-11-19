import type { FeatureSummary } from "./feature-status";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * The one sentence under the title. Short sentences, counts first.
 * Prototype copy: the shipped version moves it to `tasks:hero.*` keys.
 */
export function featureHeadline(summary: FeatureSummary): string {
  const { status, counts, total, held, waitsOn, blocks } = summary;
  const blocked = held.filter((h) => h.kind === "blocked").length;
  const asked = held.length - blocked;
  const waits =
    waitsOn.length > 0
      ? ` It cannot finish until ${waitsOn.map((x) => x.key).join(", ")} ${
          waitsOn.length === 1 ? "is" : "are"
        } done.`
      : "";

  switch (status.kind) {
    case "empty":
      return "This feature has no tasks yet.";
    case "done": {
      const open = blocks.length;
      return open > 0
        ? `All ${total} tasks are done. ${plural(open, "feature can", "features can")} continue.`
        : `All ${total} tasks are done.`;
    }
    case "notStarted":
      return `Not started. ${plural(total, "task is", "tasks are")} waiting to begin.${waits}`;
    case "asking":
      return "Nothing can move until a request is answered.";
    case "stuck":
      return "Nothing can move: every open task waits on another task.";
    case "moving": {
      const lead = `${counts.done} of ${total} tasks done.`;
      const trouble = [
        blocked > 0 ? `${blocked} blocked` : null,
        asked > 0 ? `${asked} waiting for an answer` : null,
      ].filter(Boolean);
      if (trouble.length > 0) return `${lead} ${trouble.join(", ")}.${waits}`;
      return `${lead} ${counts.doing + counts.review} in progress.${waits}`;
    }
  }
}
