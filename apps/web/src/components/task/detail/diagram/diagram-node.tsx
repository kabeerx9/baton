import { Link } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/board/avatar";
import type { LinkedTask } from "@/components/board/task-flow/linked";
import { STATUS_LABEL } from "@/components/board/model";
import { StatusIcon } from "@/components/board/status-icon";
import { NODE_H } from "./geometry";

/** What a node says about its link to this task. */
export type NodeRole =
  | { kind: "blocker" }
  | { kind: "dependent"; state: "finished" | "canContinue" | "waiting" };

function Signal({ node, role }: { node: LinkedTask; role: NodeRole }) {
  const { t } = useTranslation();
  const base =
    "inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-medium text-[11px]";
  const done = "text-emerald-600 dark:text-emerald-400";
  if (role.kind === "blocker")
    return node.status === "done" ? (
      <span className={`${base} ${done}`}>
        <CheckIcon className="size-3" aria-hidden="true" />
        {t("tasks:hero.diagram.done")}
      </span>
    ) : (
      <span className={`${base} text-amber-600 dark:text-amber-400`}>
        <span
          className="size-1.5 rounded-full bg-amber-500 motion-safe:animate-pulse"
          aria-hidden="true"
        />
        {t("tasks:hero.diagram.notDone")}
      </span>
    );
  if (role.state === "finished")
    return (
      <span className={`${base} text-muted-foreground`}>
        {t("tasks:hero.diagram.finished")}
      </span>
    );
  if (role.state === "canContinue")
    return (
      <span className={`${base} ${done}`}>
        <span
          className="size-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse"
          aria-hidden="true"
        />
        {t("tasks:hero.diagram.canContinue")}
      </span>
    );
  return (
    <span className={`${base} text-muted-foreground`}>
      {t("tasks:hero.diagram.waiting")}
    </span>
  );
}

/** A linked task on a neutral card. It opens that task. Color lives in the small signal. */
export function DiagramNode({
  node,
  role,
  index,
  side,
  workspaceId,
}: {
  node: LinkedTask;
  role: NodeRole;
  index: number;
  side: "left" | "right";
  workspaceId: string;
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -8 : 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.28,
        ease: [0.23, 1, 0.32, 1],
        delay: 0.05 + index * 0.05,
      }}
      style={{ height: NODE_H }}
    >
      <Link
        to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
        params={{ workspaceId, projectId: node.projectId, taskId: node.id }}
        className="flex h-full w-full items-center gap-3 rounded-2xl border border-border bg-card px-3.5 text-left outline-none transition-[border-color,scale] duration-150 ease-out hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.985]"
      >
        <Avatar person={node.owner} size={30} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <StatusIcon status={node.status} blocked={node.blocked} size={12} />
            {node.key}
            <span className="font-sans">· {STATUS_LABEL[node.status]}</span>
          </span>
          <span className="mt-0.5 block truncate font-medium text-[13px]">
            {node.title}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-2">
            <Signal node={node} role={role} />
            <span className="truncate text-[11px] text-muted-foreground">
              {node.owner?.name ?? t("tasks:hero.diagram.unassigned")}
            </span>
          </span>
        </span>
      </Link>
    </motion.div>
  );
}
