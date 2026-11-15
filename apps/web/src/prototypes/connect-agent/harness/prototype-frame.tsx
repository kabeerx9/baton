import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const NAV = [
  "Information",
  "Preferences",
  "Security",
  "Notifications",
  "API keys",
  "Connect an agent",
];

// A stand-in for SettingsShell, which needs a signed-in session and workspace
// data. Same frame: inset rounded panel, header strip, scrolling body.
export function PrototypeFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-svh w-full bg-background text-foreground">
      <aside
        className="hidden w-60 shrink-0 flex-col gap-0.5 p-3 md:flex"
        aria-hidden="true"
      >
        <p className="px-2 pt-2 pb-3 text-sm font-semibold">Settings</p>
        <p className="px-2 pb-1 text-xs text-muted-foreground">Account</p>
        {NAV.map((item) => (
          <span
            key={item}
            className={cn(
              "rounded-md px-2 py-1.5 text-sm",
              item === "Connect an agent"
                ? "bg-accent font-medium"
                : "text-muted-foreground",
            )}
          >
            {item}
          </span>
        ))}
      </aside>
      <main className="m-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm/5">
        <header className="flex h-12 shrink-0 items-center border-b border-border/60 px-4 text-sm text-muted-foreground">
          Settings <span className="mx-1.5">/</span> Account{" "}
          <span className="mx-1.5">/</span>
          <span className="text-foreground">Connect an agent</span>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto pb-24">{children}</div>
      </main>
    </div>
  );
}
