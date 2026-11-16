import type { PageProps } from "../../page-props";
import { toneOf, TONE_CLASS } from "../../tone";
import { MAX_NODES } from "./relay-geometry";
import { RelayColumn } from "./relay-column";
import { RelayCore } from "./relay-core";
import { RelayWires } from "./relay-wires";
import { RelayHeadline } from "./relay-headline";
import { RelayActions } from "./relay-actions";

/** Waiting made visible: who holds this up, the task, who waits on it. */
export function RelayHero(props: PageProps) {
  const { task, view } = props;
  const tone = toneOf(view.state);
  const t = TONE_CLASS[tone];
  const left = task.waitsOn.slice(0, MAX_NODES);
  const right = task.blocks.slice(0, MAX_NODES);
  const coreDone = view.state.kind === "done";
  const leftLive = view.openBlockers.length > 0 && !coreDone;
  const rightLive = coreDone && right.some((n) => n.status !== "done");

  return (
    <section
      aria-label="Task status"
      className={`relative overflow-hidden rounded-[28px] border border-border bg-card bg-gradient-to-br ${t.wash} transition-[background-color] duration-300`}
    >
      <div
        className="proto-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(70%_60%_at_50%_55%,black,transparent)]"
        aria-hidden="true"
      />
      <div className="relative px-5 pt-6 pb-5 sm:px-8 sm:pt-8">
        <RelayHeadline {...props} tone={tone} />
        <div className="mt-8 md:mt-14 flex flex-col items-stretch gap-6 md:flex-row md:items-center md:justify-between md:gap-0">
          <RelayColumn
            title="Waiting on"
            nodes={left}
            extra={task.waitsOn.length - left.length}
            ghost="Nothing in the way"
            role={{ kind: "blocker" }}
            align="left"
          />
          <RelayWires
            count={left.length}
            side="in"
            live={leftLive}
            color={
              leftLive ? "var(--color-amber-500)" : "var(--color-emerald-500)"
            }
          />
          <div className="self-center">
            <RelayCore task={task} view={view} tone={tone} />
          </div>
          <RelayWires
            count={right.length}
            side="out"
            live={rightLive}
            color={
              coreDone
                ? "var(--color-emerald-500)"
                : "var(--color-muted-foreground)"
            }
            delay={0.2}
          />
          <RelayColumn
            title="Waiting on this"
            nodes={right}
            extra={task.blocks.length - right.length}
            ghost="Nobody waits on this"
            role={{ kind: "dependent", coreDone }}
            align="right"
          />
        </div>
        <RelayActions {...props} tone={tone} />
      </div>
    </section>
  );
}
