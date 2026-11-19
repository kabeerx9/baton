import { cn } from "@/lib/cn";
import { Bone } from "./bone";
import { WORKSPACE_NAME } from "./copy";

const NAV = ["Home", "My tasks", "Board", "Inbox", "Search"];
const PROJECTS = ["Scoreboard", "Lobby display", "Referee app"];

export function AppSidebar() {
  return (
    <div className="flex w-60 shrink-0 flex-col gap-4 px-3 py-3">
      <Bone className="h-8 w-full rounded-md">
        <div className="flex h-full items-center gap-2 px-1">
          <span className="grid size-5 place-items-center rounded-md bg-primary text-[10px] font-semibold text-primary-foreground">
            L
          </span>
          <span className="truncate text-sm font-medium">{WORKSPACE_NAME}</span>
        </div>
      </Bone>
      <div className="flex flex-col gap-1">
        {NAV.map((label) => (
          <Bone key={label} className="h-7 w-full rounded-md">
            <div
              className={cn(
                "flex h-full items-center rounded-md px-2 text-sm text-muted-foreground",
                label === "Board" && "bg-accent text-foreground",
              )}
            >
              {label}
            </div>
          </Bone>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <Bone className="h-5 w-16 rounded-sm">
          <span className="px-2 text-xs text-muted-foreground">Projects</span>
        </Bone>
        {PROJECTS.map((label) => (
          <Bone key={label} className="h-7 w-full rounded-md">
            <div className="flex h-full items-center px-2 text-sm text-muted-foreground">
              {label}
            </div>
          </Bone>
        ))}
      </div>
    </div>
  );
}
