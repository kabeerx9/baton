import { CommandIcon, SearchIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toneOf, TONE_CLASS } from "../../tone";
import type { PageProps } from "../../page-props";
import { DescriptionBlock } from "../../shared/description-block";
import { headline } from "../../copy";
import { CommandBar } from "./command-bar";
import { ConsoleLog } from "./console-log";
import { ConsoleRail } from "./console-rail";
import { KeyHint } from "./key-hint";
import { NextStrip } from "./next-strip";
import { PropertyBar } from "./property-bar";
import { useConsoleShortcuts } from "./use-console-shortcuts";

/**
 * Console. The axis is speed: every property is a chip with a key, a command
 * bar does the rest, and a rail keeps the chain of tasks in view.
 */
export function ConsoleVariant(props: PageProps) {
  const { task, view, viewer, dispatch } = props;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);
  const tone = TONE_CLASS[toneOf(view.state)];

  useConsoleShortcuts(props, {
    openPalette: () => setPaletteOpen(true),
    focusComment: () => composerRef.current?.querySelector("textarea")?.focus(),
  });

  return (
    <div className="min-h-svh">
      <div className={`h-0.5 w-full ${tone.dot}`} aria-hidden="true" />
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/85 px-4 py-2 backdrop-blur sm:px-6">
        <span className="font-mono text-xs text-muted-foreground">
          {task.repo} <span aria-hidden="true">/</span>{" "}
          <span className="text-foreground">{task.key}</span>
        </span>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="ml-3 hidden items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-[background-color,scale] duration-150 hover:bg-accent/60 active:scale-[0.97] sm:flex"
        >
          <SearchIcon className="size-3.5" aria-hidden="true" />
          Run a command
          <KeyHint keys="mod+k" />
        </button>
        <button
          type="button"
          aria-label="Command bar"
          onClick={() => setPaletteOpen(true)}
          className="ml-2 grid size-8 place-items-center rounded-lg border border-border sm:hidden"
        >
          <CommandIcon className="size-4" aria-hidden="true" />
        </button>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-6 px-4 py-8 sm:px-8 lg:px-12">
          <div>
            <p
              className={`mb-2 flex items-center gap-2 text-xs font-medium ${tone.text}`}
            >
              <span
                className={`size-1.5 rounded-full ${tone.dot}`}
                aria-hidden="true"
              />
              {headline(view.state, task)}
            </p>
            <h1 className="max-w-3xl text-balance text-[26px] leading-tight font-semibold tracking-tight">
              {task.title}
            </h1>
          </div>
          <PropertyBar {...props} />
          <NextStrip {...props} />
          <section aria-label="Brief">
            <h2 className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Brief
            </h2>
            <DescriptionBlock task={task} />
          </section>
          <ConsoleLog {...props} composerRef={composerRef} />
        </main>
        <aside
          aria-label="Context"
          className="border-t border-border bg-muted/30 lg:sticky lg:top-[49px] lg:h-[calc(100svh-49px)] lg:overflow-y-auto lg:border-t-0 lg:border-l"
        >
          <ConsoleRail {...props} />
        </aside>
      </div>
      <CommandBar
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        viewer={viewer}
        dispatch={dispatch}
      />
    </div>
  );
}
