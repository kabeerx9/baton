import { ChevronRightIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { cn } from "@/lib/cn";
import { rowMotion } from "./row-motion";
import { TaskRow } from "./task-row";

/** A long section shows this many rows until the person asks for the rest. */
const CAP = 8;

/** A titled group of task rows. It can start collapsed for the long tail. */
export function TaskSection({
  title,
  tasks,
  day,
  workspaceId,
  tone = "default",
  collapsible = false,
  defaultOpen = true,
  onDone,
  onFocus,
}: {
  title: string;
  tasks: AssignedTask[];
  day: number;
  workspaceId: string;
  tone?: "default" | "danger" | "muted";
  collapsible?: boolean;
  defaultOpen?: boolean;
  onDone: (task: AssignedTask) => void;
  onFocus: (task: AssignedTask) => void;
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [all, setAll] = useState(false);
  if (tasks.length === 0) return null;
  const shown = all ? tasks : tasks.slice(0, CAP);

  const list = (
    <div className="flex flex-col gap-2">
      <ul className="overflow-hidden rounded-xl border bg-card">
        <AnimatePresence initial={false}>
          {shown.map((task) => (
            <motion.li
              className="overflow-hidden not-first:border-t"
              key={task.id}
              {...rowMotion(reduced)}
            >
              <TaskRow
                day={day}
                onDone={() => onDone(task)}
                onFocus={() => onFocus(task)}
                task={task}
                workspaceId={workspaceId}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {tasks.length > CAP ? (
        <Button
          className="self-start"
          onClick={() => setAll(!all)}
          size="xs"
          variant="ghost"
        >
          {all
            ? t("workspace:myTasks.showFewer")
            : t("workspace:myTasks.sections.showAll", { count: tasks.length })}
        </Button>
      ) : null}
    </div>
  );

  const heading = (
    <span className="flex items-baseline gap-2">
      <span
        className={cn(
          "font-semibold text-sm",
          tone === "danger" && "text-destructive-foreground",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {title}
      </span>
      <span className="font-normal text-muted-foreground text-xs tabular-nums">
        {tasks.length}
      </span>
    </span>
  );

  if (!collapsible) {
    return (
      <section className="flex flex-col gap-2.5">
        <h2>{heading}</h2>
        {list}
      </section>
    );
  }
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <section className="flex flex-col">
        <h2>
          <CollapsibleTrigger className="group -ml-1 flex items-center gap-1 rounded-md py-0.5 pr-2 pl-1 outline-none transition-colors duration-100 hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRightIcon
              aria-hidden="true"
              className="size-3.5 text-muted-foreground transition-transform duration-150 ease-out group-data-open:rotate-90 motion-reduce:transition-none"
            />
            {heading}
          </CollapsibleTrigger>
        </h2>
        <CollapsiblePanel className="ease-(--ease-out) motion-reduce:transition-none">
          <div className="pt-2.5">{list}</div>
        </CollapsiblePanel>
      </section>
    </Collapsible>
  );
}
