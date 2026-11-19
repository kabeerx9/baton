import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { AppShell } from "./app-shell";
import { bonePhase } from "./bone-phase";
import type { PageId } from "./copy";
import { ErrorSlot } from "./error-slot";
import type { LoadView } from "./load-view";
import { PageBody } from "./page-body";

type LoadingScreenProps = {
  screen: "splash" | "page";
  page: PageId;
  view: LoadView;
  /** true: the skeleton is the loading UI. false: `overlay` is. */
  bones: boolean;
  overlay?: ReactNode;
  onRetry: () => void;
};

/**
 * Shared stage for every direction. The destination screen is always mounted,
 * so its layout is fixed from the first frame; only paint changes.
 */
export function LoadingScreen({
  screen,
  page,
  view,
  bones,
  overlay,
  onRetry,
}: LoadingScreenProps) {
  const phase = bones ? bonePhase(view) : "content";
  const hidden = !bones && (view.kind === "quiet" || view.kind === "loading");
  const overlayUp =
    view.kind === "loading" || (view.kind === "handoff" && view.wasShown);
  const overlayNode =
    !bones && overlayUp ? (
      <div
        className={cn(
          "absolute inset-0 z-10",
          screen === "splash" && "bg-background",
          view.kind === "handoff" ? "ld-leaving" : "",
        )}
      >
        {overlay}
      </div>
    ) : null;
  // Before the delay, the splash is a blank page, not a shell with holes.
  const blankCover =
    !bones && screen === "splash" && view.kind !== "done" && !overlayNode;

  return (
    <div
      className="ld-stage relative h-full w-full overflow-hidden bg-background text-foreground"
      data-bones={bones}
      data-screen={screen}
      data-view={view.kind}
    >
      {view.kind === "failed" ? (
        screen === "splash" ? (
          <ErrorSlot where="screen" onRetry={onRetry} />
        ) : (
          <AppShell page={page} shellPhase="content" regionPhase="content">
            <ErrorSlot where="region" onRetry={onRetry} />
          </AppShell>
        )
      ) : (
        <>
          <div
            className={cn(
              "ld-app h-full",
              !bones && screen === "splash" && hidden && "invisible",
            )}
          >
            <AppShell
              page={page}
              shellPhase={screen === "splash" ? phase : "content"}
              regionPhase={phase}
              regionHidden={!bones && screen === "page" && hidden}
              regionOverlay={screen === "page" ? overlayNode : undefined}
              regionClassName={
                !bones && view.kind === "handoff" ? "[&>div]:ld-enter" : ""
              }
            >
              <PageBody page={page} />
            </AppShell>
          </div>
          {screen === "splash" ? overlayNode : null}
          {blankCover ? (
            <div className="absolute inset-0 z-10 bg-background" />
          ) : null}
        </>
      )}
    </div>
  );
}
