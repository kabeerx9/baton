import { useState } from "react";
import { Avatar } from "@/components/board/avatar";
import { headline, subline } from "../../copy";
import { copyKey } from "../../copy-key";
import type { PageProps } from "../../page-props";
import { toneOf } from "../../tone";
import { ActionRow } from "./action-row";
import { CalmCore } from "./calm-core";
import { CALM } from "./calm-tone";
import { Diagram } from "./diagram";
import { RequestBanner } from "./request-banner";
import { StatusMenu } from "./status-menu";
import { StatusSegments } from "./status-segments";
import { useStatusKeys } from "./use-status-keys";

export type StatusControl = "node" | "bar" | "action";

/** The hero. One axis varies: where the status switch lives. */
export function Hero2({
  control,
  ...props
}: PageProps & { control: StatusControl }) {
  const { task, view, viewer, dispatch } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  useStatusKeys(
    { viewer, dispatch },
    control === "bar" ? undefined : () => setMenuOpen(true),
  );
  const tone = CALM[toneOf(view.state)];
  const request = !viewer.involved;

  const core =
    control === "node" ? (
      <StatusMenu
        task={task}
        view={view}
        viewer={viewer}
        dispatch={dispatch}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        align="center"
        trigger={<CalmCore view={view} interactive request={request} />}
      />
    ) : (
      <CalmCore view={view} interactive={false} request={request} />
    );

  const signal =
    view.state.kind === "blocked"
      ? "Blocked"
      : view.state.kind === "awaiting"
        ? "Request pending"
        : null;

  return (
    <section
      aria-label="Task status"
      className={`relative overflow-hidden rounded-3xl border bg-card ${tone.border}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b ${tone.glow} to-transparent`}
        aria-hidden="true"
      />
      <div className="relative px-5 pt-6 pb-6 sm:px-8 sm:pt-7">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-foreground">
            {task.key}
          </span>
          <span>{task.repo}</span>
          <span aria-hidden="true">·</span>
          <span>created {task.createdAgo}</span>
          <button
            type="button"
            onClick={() => copyKey(task.key)}
            className="ml-auto rounded-md px-1.5 py-0.5 transition-colors duration-150 hover:bg-accent active:scale-[0.97]"
          >
            Copy key
          </button>
        </div>
        <h1 className="mt-3 max-w-3xl text-balance text-[26px] leading-[1.15] font-semibold tracking-tight sm:text-3xl">
          {task.title}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm">
          <span
            className={`inline-flex items-center gap-1.5 font-medium ${tone.text}`}
          >
            <span
              className={`size-1.5 rounded-full ${tone.dot}`}
              aria-hidden="true"
            />
            {headline(view.state, task)}
          </span>
          <span className="text-muted-foreground">{subline(view, task)}</span>
        </p>

        {control === "bar" && (
          <div className="mt-5">
            <StatusSegments {...props} />
          </div>
        )}

        <Diagram {...props} core={core} />

        <div className="mt-5 flex flex-col items-center gap-2 md:mt-6">
          {signal && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone.pill}`}
            >
              {signal}
            </span>
          )}
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar person={task.assignee} size={22} />
            {task.assignee ? `Owned by ${task.assignee.name}` : "No owner yet"}
          </span>
        </div>

        {control === "action" && (
          <div className="mt-6 border-t border-border pt-5">
            <ActionRow
              {...props}
              menuOpen={menuOpen}
              onMenuOpen={setMenuOpen}
            />
          </div>
        )}
        {control === "node" && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {request
              ? "Click the circle to send a status request."
              : "Click the circle to change the status."}
          </p>
        )}
        <RequestBanner {...props} />
      </div>
    </section>
  );
}
