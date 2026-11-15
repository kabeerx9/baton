import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

/** Open tasks per repo. Pressing a repo narrows the page to it; pressing again clears. */
export function RepoFilter({
  repos,
  total,
  activeId,
  onChange,
}: {
  repos: { id: string; name: string; count: number }[];
  total: number;
  activeId: string | null;
  onChange: (repoId: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <ul className="-mx-2 flex flex-col">
      {repos.map((repo) => {
        const active = repo.id === activeId;
        return (
          <li key={repo.id}>
            <button
              aria-label={t(
                active
                  ? "workspace:myTasks.rail.repoAll"
                  : "workspace:myTasks.rail.repoOnly",
                { name: repo.name, count: repo.count },
              )}
              aria-pressed={active}
              className={cn(
                "group flex w-full cursor-pointer flex-col gap-1.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors duration-100 hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
                activeId && !active && "opacity-50",
              )}
              onClick={() => onChange(active ? null : repo.id)}
              type="button"
            >
              <span className="flex items-baseline justify-between gap-2 text-xs">
                <span className={cn("truncate", active && "font-medium")}>
                  {repo.name}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {repo.count}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="block h-1 w-full overflow-hidden rounded-full bg-foreground/8"
              >
                <span
                  className="block h-full rounded-full bg-foreground/70 transition-[width] duration-300 ease-(--ease-out) motion-reduce:transition-none"
                  style={{
                    width: `${(repo.count / Math.max(1, total)) * 100}%`,
                  }}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
