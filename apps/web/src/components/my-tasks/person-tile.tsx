import { ArrowUpIcon, LockIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import type { WaitingPerson } from "./focus-plan";
import { PersonAvatar } from "./person-avatar";
import { finishBlock, taskKey } from "./task-facts";

/** One teammate who is stuck: what they need, and a way to do it first. */
export function PersonTile({
  person,
  nextId,
  onFocus,
}: {
  person: WaitingPerson;
  nextId: string | null;
  onFocus: (task: AssignedTask) => void;
}) {
  const { t } = useTranslation();
  const [first] = person.stuck;
  if (!first) return null;
  const { blocker } = first;
  const more = person.stuck.length - 1;
  const name = person.name ?? t("workspace:myTasks.people.nobody");
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-xl border bg-card py-2.5 pr-2.5 pl-3">
      <PersonAvatar name={person.fullName} size={28} />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-sm">
          <span className="font-medium">{name}</span>
          <span className="text-muted-foreground">
            {" "}
            {t("workspace:myTasks.people.needs")}{" "}
          </span>
          <span className="tabular-nums">{taskKey(blocker)}</span>
        </p>
        <p className="truncate text-muted-foreground text-xs">
          <span className="tabular-nums">{first.key}</span> · {first.title}
          {more > 0
            ? ` ${t("workspace:myTasks.people.andMore", { count: more })}`
            : ""}
        </p>
      </div>
      {blocker.id === nextId ? (
        <span className="flex shrink-0 items-center gap-1 pr-1 text-muted-foreground text-xs">
          <ArrowUpIcon aria-hidden="true" className="size-3" />
          {t("workspace:myTasks.people.upNext")}
        </span>
      ) : finishBlock(blocker) === "held" ? (
        <span className="flex shrink-0 items-center gap-1 pr-1 text-muted-foreground text-xs">
          <LockIcon aria-hidden="true" className="size-3" />
          {t("workspace:myTasks.people.heldUp")}
        </span>
      ) : (
        <Button
          aria-label={t("workspace:myTasks.people.doFirstLabel", {
            key: taskKey(blocker),
            name,
          })}
          onClick={() => onFocus(blocker)}
          size="xs"
          variant="outline"
        >
          {t("workspace:myTasks.people.doFirst")}
        </Button>
      )}
    </li>
  );
}
