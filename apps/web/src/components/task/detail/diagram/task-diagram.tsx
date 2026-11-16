import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { LinkedTask } from "@/components/board/task-flow/linked";
import { dependentState } from "@/components/board/task-flow/page-blocked";
import { DiagramColumn } from "./diagram-column";
import { EmptySide } from "./empty-side";
import { MAX_NODES } from "./geometry";
import { Wires } from "./wires";

/**
 * Waits on, this task, waiting on this. An empty side becomes one line. With
 * both sides empty only the circle is left.
 */
export function TaskDiagram({
  waitsOn,
  blocks,
  done,
  stillNeeded,
  workspaceId,
  core,
}: {
  waitsOn: LinkedTask[];
  blocks: LinkedTask[];
  /** This task is finished: the outgoing wires settle. */
  done: boolean;
  /** An open task still holds this one up. */
  stillNeeded: boolean;
  workspaceId: string;
  core: ReactNode;
}) {
  const { t } = useTranslation();
  const calm = "var(--color-muted-foreground)";
  const rightLive = done && blocks.some((n) => n.status !== "done");

  if (waitsOn.length === 0 && blocks.length === 0)
    return (
      <div className="mt-8 flex flex-col items-center gap-3">
        {core}
        <p className="text-muted-foreground text-sm">
          {t("tasks:hero.diagram.emptyBoth")}
        </p>
      </div>
    );

  return (
    <div
      role="group"
      aria-label={t("tasks:hero.diagram.label")}
      className="mt-8 flex flex-col items-stretch gap-8 md:mt-12 md:flex-row md:items-center md:justify-center md:gap-0"
    >
      {waitsOn.length > 0 ? (
        <>
          <DiagramColumn
            heading={t("tasks:hero.diagram.waitsOn")}
            nodes={waitsOn}
            roleOf={() => ({ kind: "blocker" })}
            side="left"
            workspaceId={workspaceId}
          />
          <Wires
            count={Math.min(waitsOn.length, MAX_NODES)}
            side="in"
            live={stillNeeded}
            color={stillNeeded ? "var(--color-amber-500)" : calm}
          />
        </>
      ) : (
        <EmptySide
          heading={t("tasks:hero.diagram.waitsOn")}
          text={t("tasks:hero.diagram.emptyLeft")}
        />
      )}
      <div className="relative flex flex-col items-center self-center md:mx-2">
        <h2 className="mb-2 font-semibold text-[11px] text-foreground uppercase tracking-wider md:absolute md:-top-7 md:mb-0 md:whitespace-nowrap">
          {t("tasks:hero.diagram.thisTask")}
        </h2>
        {core}
      </div>
      {blocks.length > 0 ? (
        <>
          <Wires
            count={Math.min(blocks.length, MAX_NODES)}
            side="out"
            live={rightLive}
            color={done ? "var(--color-emerald-500)" : calm}
            delay={0.15}
          />
          <DiagramColumn
            heading={t("tasks:hero.diagram.waitingOnThis")}
            nodes={blocks}
            roleOf={(n) => ({
              kind: "dependent",
              state: dependentState({
                thisDone: done,
                dependentDone: n.status === "done",
                waiting: n.blocked ?? !done,
              }),
            })}
            side="right"
            workspaceId={workspaceId}
          />
        </>
      ) : (
        <EmptySide
          heading={t("tasks:hero.diagram.waitingOnThis")}
          text={t("tasks:hero.diagram.emptyRight")}
        />
      )}
    </div>
  );
}
