import { useSetStatus } from "@/hooks/mutations/board/use-set-status";
import { STATUS_LABEL, type Status } from "../model";
import { StatusIcon } from "../status-icon";

const SLUG: Record<Status, string> = {
  todo: "to-do",
  doing: "in-progress",
  review: "in-review",
  done: "done",
};
const ORDER: Status[] = ["todo", "doing", "review", "done"];

/** The four statuses side by side. One click moves the task. */
export function StatusSteps({
  taskId,
  status,
  blocked,
}: {
  taskId: string;
  status: Status;
  /** A blocked task can be started but not finished. */
  blocked: boolean;
}) {
  const setStatus = useSetStatus();
  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Status"
        className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1"
      >
        {ORDER.map((s) => {
          const on = s === status;
          const locked = blocked && s === "done";
          return (
            // biome-ignore lint/a11y/useSemanticElements: segmented control
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={locked || setStatus.isPending}
              title={
                locked ? "Blocked: finish what this waits on first" : undefined
              }
              onClick={() =>
                !on && setStatus.mutate({ taskId, status: SLUG[s] })
              }
              className={`flex flex-col items-center gap-1 rounded-md py-1.5 text-[10.5px] outline-none transition-[background-color,color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 ${
                on
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <StatusIcon status={s} size={13} />
              {STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>
      {setStatus.isError && (
        <p role="alert" className="mt-2 text-destructive text-xs">
          {setStatus.error.message}
        </p>
      )}
    </div>
  );
}
