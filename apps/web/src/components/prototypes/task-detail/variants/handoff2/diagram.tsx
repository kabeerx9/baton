import type { ReactNode } from "react";
import type { PageProps } from "../../page-props";
import { RelayWires } from "../handoff/relay-wires";
import { CalmColumn } from "./calm-column";
import { EmptySide } from "./empty-side";

/**
 * Waits on  →  THIS TASK  →  Waiting on this. An empty side becomes one line.
 * With both sides empty only the circle is left.
 */
export function Diagram({ task, view, core }: PageProps & { core: ReactNode }) {
  const left = task.waitsOn;
  const right = task.blocks;
  const coreDone = view.state.kind === "done";
  const leftLive = view.openBlockers.length > 0 && !coreDone;
  const rightLive = coreDone && right.some((n) => n.status !== "done");
  const leftShown = Math.min(left.length, 3);
  const rightShown = Math.min(right.length, 3);
  const calm = "var(--color-muted-foreground)";

  if (left.length === 0 && right.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3">
        {core}
        <p className="text-sm text-muted-foreground">
          Nothing is in the way, and nobody waits on this.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col items-stretch gap-8 md:mt-12 md:flex-row md:items-center md:justify-center md:gap-0">
      {left.length > 0 ? (
        <>
          <CalmColumn
            heading="Waits on"
            nodes={left}
            total={left.length}
            role={{ kind: "blocker" }}
            align="left"
          />
          <RelayWires
            count={leftShown}
            side="in"
            live={leftLive}
            color={leftLive ? "var(--color-amber-500)" : calm}
          />
        </>
      ) : (
        <EmptySide heading="Waits on" text="Nothing in the way" />
      )}
      <div className="relative flex flex-col items-center self-center md:mx-2">
        <h2 className="mb-2 text-[11px] font-semibold tracking-wider text-foreground uppercase md:absolute md:-top-7 md:mb-0 md:whitespace-nowrap">
          This task
        </h2>
        {core}
      </div>
      {right.length > 0 ? (
        <>
          <RelayWires
            count={rightShown}
            side="out"
            live={rightLive}
            color={coreDone ? "var(--color-emerald-500)" : calm}
            delay={0.15}
          />
          <CalmColumn
            heading="Waiting on this"
            nodes={right}
            total={right.length}
            role={{ kind: "dependent", coreDone }}
            align="right"
          />
        </>
      ) : (
        <EmptySide heading="Waiting on this" text="Nobody waits on this" />
      )}
    </div>
  );
}
