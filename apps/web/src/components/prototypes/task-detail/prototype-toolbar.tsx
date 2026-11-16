import { MoonIcon, SunIcon, ZapIcon } from "lucide-react";
import type { Dispatch } from "react";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { DATA_SETS } from "./mock-data";
import type { TaskView } from "./derive";
import type { TaskAction } from "./task-state";
import type { DataSetId, TaskDetail } from "./types";
import { useSearchSetter } from "./use-search-setter";
import { VIEWERS, type ViewerId } from "./use-task-state";

const mono = "font-mono text-[11px]";
const chip =
  "rounded-md border border-border px-2 py-1 transition-colors duration-150 hover:bg-accent data-[on]:border-foreground/40 data-[on]:bg-accent data-[on]:text-foreground text-muted-foreground active:scale-[0.97]";

/** Harness chrome: data set, who is looking, a way to make the world move, theme. */
export function PrototypeToolbar({
  task,
  view,
  dispatch,
  dataSet,
  viewerId,
}: {
  task: TaskDetail;
  view: TaskView;
  dispatch: Dispatch<TaskAction>;
  dataSet: DataSetId;
  viewerId: ViewerId;
}) {
  const setSearch = useSearchSetter();
  const theme = useUserPreferencesStore((s) => s.theme);
  const setTheme = useUserPreferencesStore((s) => s.setTheme);
  const dark = theme === "dark";
  const first = view.openBlockers[0];

  return (
    <div
      className={`fixed top-3 right-3 z-[60] flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-end gap-1.5 rounded-xl border border-border bg-popover/90 p-1.5 shadow-md/5 backdrop-blur ${mono}`}
      role="toolbar"
      aria-label="Prototype controls"
    >
      {(Object.keys(DATA_SETS) as DataSetId[]).map((id) => (
        <button
          key={id}
          type="button"
          className={chip}
          data-on={id === dataSet ? "" : undefined}
          aria-pressed={id === dataSet}
          onClick={() => setSearch({ d: id })}
        >
          {id === "busy" ? "Busy" : id.toUpperCase()}
        </button>
      ))}
      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
      {(Object.keys(VIEWERS) as ViewerId[]).map((id) => (
        <button
          key={id}
          type="button"
          className={chip}
          data-on={id === viewerId ? "" : undefined}
          aria-pressed={id === viewerId}
          onClick={() => setSearch({ u: id })}
        >
          {id === "me" ? "Involved" : "Member"}
        </button>
      ))}
      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
      <button
        type="button"
        className={`${chip} inline-flex items-center gap-1 disabled:opacity-40`}
        disabled={!first || task.status === "done"}
        title="Pretend the first open blocker just finished"
        onClick={() =>
          first && dispatch({ type: "blocker-finished", key: first.key })
        }
      >
        <ZapIcon className="size-3" aria-hidden="true" />
        {first ? `Finish ${first.key}` : "No blocker"}
      </button>
      <button
        type="button"
        className={chip}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => setTheme(dark ? "light" : "dark")}
      >
        {dark ? (
          <SunIcon className="size-3" aria-hidden="true" />
        ) : (
          <MoonIcon className="size-3" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
