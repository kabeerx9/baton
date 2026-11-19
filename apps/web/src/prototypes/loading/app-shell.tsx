import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { BonePhase } from "./bone-phase";
import { BoneContext } from "./bone-context";
import { Bone } from "./bone";
import { AppSidebar } from "./app-sidebar";
import { PAGE_LABEL, WORKSPACE_NAME, type PageId } from "./copy";

type AppShellProps = {
  page: PageId;
  /** Sidebar and header. Known before data in the page screens. */
  shellPhase: BonePhase;
  regionPhase: BonePhase;
  /** Keep the region's layout but do not paint it. */
  regionHidden?: boolean;
  regionClassName?: string;
  /** Sits over the region, in the region's box. */
  regionOverlay?: ReactNode;
  children: ReactNode;
};

/** A stand-in for Baton's workspace shell: sidebar, inset panel, header. */
export function AppShell({
  page,
  shellPhase,
  regionPhase,
  regionHidden,
  regionClassName,
  regionOverlay,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-full w-full bg-sidebar">
      <BoneContext value={shellPhase}>
        <div className="hidden md:block">
          <AppSidebar />
        </div>
      </BoneContext>
      <div className="m-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm/5 md:ms-0">
        <BoneContext value={shellPhase}>
          <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
            <Bone className="h-4 w-44 rounded-sm">
              <p className="truncate text-xs text-muted-foreground">
                {WORKSPACE_NAME} <span className="px-1">/</span>
                <span className="text-foreground">{PAGE_LABEL[page]}</span>
              </p>
            </Bone>
          </header>
        </BoneContext>
        <BoneContext value={regionPhase}>
          <div className={cn("relative min-h-0 flex-1", regionClassName)}>
            <div className={cn("h-full", regionHidden && "invisible")}>
              {children}
            </div>
            {regionOverlay}
          </div>
        </BoneContext>
      </div>
    </div>
  );
}
