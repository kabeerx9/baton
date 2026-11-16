import { GitPullRequestIcon } from "lucide-react";
import { Avatar } from "@/components/board/avatar";
import type { PageProps } from "../../page-props";

export function DetailsPanel({ task }: PageProps) {
  return (
    <div className="space-y-5 text-sm">
      <section>
        <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          People
        </h3>
        <ul className="space-y-2">
          <li className="flex items-center gap-2">
            <Avatar person={task.creator} size={20} />
            {task.creator.name}
            <span className="ml-auto text-xs text-muted-foreground">
              Creator
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Avatar person={task.assignee} size={20} />
            {task.assignee?.name ?? "Unassigned"}
            <span className="ml-auto text-xs text-muted-foreground">Owner</span>
          </li>
        </ul>
      </section>
      {task.pullRequest ? (
        <section>
          <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Pull request
          </h3>
          <div className="rounded-lg border border-border p-2.5">
            <p className="flex items-center gap-2 font-medium">
              <GitPullRequestIcon
                className="size-4 text-emerald-500"
                aria-hidden="true"
              />
              #{task.pullRequest.number}
              <span className="ml-auto text-xs font-normal text-emerald-600 dark:text-emerald-400">
                checks {task.pullRequest.checks}
              </span>
            </p>
            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
              {task.pullRequest.branch}
            </p>
          </div>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
          No pull request linked yet.
        </p>
      )}
      {task.related.length > 0 && (
        <section>
          <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Related
          </h3>
          <ul className="space-y-1">
            {task.related.map((r) => (
              <li key={r.key} className="truncate">
                <span className="font-mono text-xs text-muted-foreground">
                  {r.key}
                </span>{" "}
                {r.title}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-muted-foreground">
        Created {task.createdAgo}.
      </p>
    </div>
  );
}
