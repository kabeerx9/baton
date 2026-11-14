import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { TeamHistoryResponse } from "@/fetchers/board/get-team-history";
import { Avatar } from "../avatar";
import { type Lane, laneOf, toPerson } from "../model";
import { dayLabel } from "./day-label";

const SHOWN = 4;
const NO_REPO = "var(--color-zinc-400)";

type PersonHistory = TeamHistoryResponse["people"][number];

/** Everything about one person's period: the count, the repo split, the latest tasks. */
export function PersonCard({
  person,
  lanes,
  workspaceId,
}: {
  person: PersonHistory;
  lanes: Lane[];
  workspaceId: string;
}) {
  const [all, setAll] = useState(false);
  const color = (projectId: string) =>
    laneOf(lanes, projectId)?.tone.stroke ?? NO_REPO;
  const recent = all ? person.recent : person.recent.slice(0, SHOWN);
  const hidden = person.done - recent.length;

  return (
    <article className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Avatar person={toPerson(person.user)} size={40} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-medium text-sm">{person.user.name}</h2>
          <p className="text-muted-foreground text-xs tabular-nums">
            {person.open} open now
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-3xl leading-none tabular-nums">
            {person.done}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {person.done === 1 ? "task finished" : "tasks finished"}
          </p>
        </div>
      </div>

      {person.done > 0 && (
        <>
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-border">
            {person.byRepo.map((repo) => (
              <span
                key={repo.projectId}
                style={{ flex: repo.count, background: color(repo.projectId) }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {person.byRepo.map((repo) => (
              <span
                key={repo.projectId}
                className="inline-flex items-center gap-1"
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: color(repo.projectId) }}
                />
                {repo.name.replace(/\s*\(.*\)\s*$/, "")} {repo.count}
              </span>
            ))}
          </div>
        </>
      )}

      <ul className="mt-4 border-border border-t pt-3">
        {recent.map((task) => (
          <li key={task.id}>
            <Link
              to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
              params={{
                workspaceId,
                projectId: task.projectId,
                taskId: task.id,
              }}
              className="flex items-center gap-2 rounded px-1 py-1 text-[12.5px] outline-none transition-colors duration-150 ease-out hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="w-14 shrink-0 font-mono text-[10.5px] text-muted-foreground">
                {task.key}
              </span>
              <span className="min-w-0 flex-1 truncate">{task.title}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {dayLabel(task.finishedAt)}
              </span>
            </Link>
          </li>
        ))}
        {person.done === 0 && (
          <li className="px-1 py-1 text-muted-foreground text-xs">
            Nothing finished in this period.
          </li>
        )}
        {!all && hidden > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setAll(true)}
              className="mt-1 rounded px-1 text-[11px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              and {hidden} more
            </button>
          </li>
        )}
        {all && hidden > 0 && (
          <li className="px-1 pt-1 text-[11px] text-muted-foreground">
            and {hidden} older, not shown
          </li>
        )}
      </ul>
    </article>
  );
}
