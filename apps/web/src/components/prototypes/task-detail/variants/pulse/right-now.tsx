import { ArrowRightIcon, CheckIcon, XIcon } from "lucide-react";
import { Avatar } from "@/components/board/avatar";
import { StatusIcon } from "@/components/board/status-icon";
import { Button } from "@/components/ui/button";
import { STAGE_LABEL } from "../../copy";
import type { PageProps } from "../../page-props";
import { nextActionControl } from "../../shared/use-next-action";
import type { Linked } from "../../types";

function Chip({ item, tone }: { item: Linked; tone: "wait" | "free" }) {
  return (
    <li className="flex items-center gap-2 rounded-xl bg-muted/70 px-2.5 py-1.5 text-sm">
      <StatusIcon status={item.status} size={13} />
      <span className="font-mono text-xs text-muted-foreground">
        {item.key}
      </span>
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      <Avatar person={item.owner} size={18} />
      <span
        className={`hidden text-xs sm:inline ${tone === "wait" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
      >
        {STAGE_LABEL[item.status]}
      </span>
    </li>
  );
}

/** The card that overlaps the band: what to do now, and who it affects. */
export function RightNow({ view, viewer, dispatch, task }: PageProps) {
  const control = nextActionControl({ view, viewer, dispatch });
  const { state, next } = view;
  const waitedBy = view.waitingOnMe;
  return (
    <section
      aria-label="Right now"
      className="relative z-10 -mt-8 rounded-2xl border border-border bg-card p-4 shadow-xl/5 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Next
        </h2>
        {state.kind === "awaiting" && next.kind === "answer" ? (
          <>
            <p className="min-w-0 flex-1 text-sm">
              <b>{state.request.requester.name.split(" ")[0]}</b> asked to move
              this to <b>{STAGE_LABEL[state.request.to]}</b>.{" "}
              <span className="text-muted-foreground">
                {state.request.expires}
              </span>
            </p>
            <Button
              size="sm"
              onClick={() => dispatch({ type: "answer", accept: true, viewer })}
            >
              <CheckIcon aria-hidden="true" /> Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                dispatch({ type: "answer", accept: false, viewer })
              }
            >
              <XIcon aria-hidden="true" /> Reject
            </Button>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              {state.kind === "done"
                ? "Nothing left to do on this task."
                : state.kind === "blocked"
                  ? "Start whenever you like. Finishing waits for the tasks below."
                  : state.kind === "unknown"
                    ? "Baton does not know this status."
                    : state.kind === "awaiting"
                      ? "Waiting for someone involved to answer."
                      : task.assignee
                        ? `${task.assignee.name.split(" ")[0]} can move it on.`
                        : "Nobody owns it. Take it to start."}
            </p>
            {control.run && (
              <Button onClick={control.run}>
                {control.label}
                <ArrowRightIcon aria-hidden="true" />
              </Button>
            )}
          </>
        )}
      </div>
      {(view.openBlockers.length > 0 || waitedBy.length > 0) && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {view.openBlockers.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                Waiting on
              </p>
              <ul className="space-y-1.5">
                {view.openBlockers.map((b) => (
                  <Chip key={b.key} item={b} tone="wait" />
                ))}
              </ul>
            </div>
          )}
          {waitedBy.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Waiting on this
              </p>
              <ul className="space-y-1.5">
                {waitedBy.map((b) => (
                  <Chip key={b.key} item={b} tone="free" />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {state.kind === "done" && state.released.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Can continue now
          </p>
          <ul className="space-y-1.5">
            {state.released.map((b) => (
              <Chip key={b.key} item={b} tone="free" />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
