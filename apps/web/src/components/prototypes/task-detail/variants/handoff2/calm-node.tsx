import { CheckIcon } from "lucide-react";
import { motion } from "motion/react";
import { Avatar } from "@/components/board/avatar";
import { StatusIcon } from "@/components/board/status-icon";
import { STAGE_LABEL } from "../../copy";
import type { Linked } from "../../types";
import type { NodeRole } from "../handoff/relay-node";
import { NODE_H } from "../handoff/relay-geometry";

function Signal({ node, role }: { node: Linked; role: NodeRole }) {
  const base =
    "inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium";
  if (node.status === "done")
    return (
      <span className={`${base} text-emerald-600 dark:text-emerald-400`}>
        <CheckIcon className="size-3" aria-hidden="true" />
        Done
      </span>
    );
  if (role.kind === "blocker")
    return (
      <span className={`${base} text-amber-600 dark:text-amber-400`}>
        <span className="proto-breathe size-1.5 rounded-full bg-amber-500" />
        Not done yet
      </span>
    );
  if (!role.coreDone)
    return <span className={`${base} text-muted-foreground`}>Waiting</span>;
  if ((node.otherBlockers ?? 0) > 0)
    return (
      <span className={`${base} text-muted-foreground`}>
        Also waits on {node.otherBlockers} more
      </span>
    );
  return (
    <span className={`${base} text-emerald-600 dark:text-emerald-400`}>
      <span className="proto-breathe size-1.5 rounded-full bg-emerald-500" />
      Can continue
    </span>
  );
}

/** A linked task, on a neutral card. Color lives only in the small signal. */
export function CalmNode({
  node,
  role,
  index,
  align,
}: {
  node: Linked;
  role: NodeRole;
  index: number;
  align: "left" | "right";
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, x: align === "left" ? -8 : 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.28,
        ease: [0.23, 1, 0.32, 1],
        delay: 0.05 + index * 0.05,
      }}
      style={{ height: NODE_H }}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3.5 text-left outline-none transition-[border-color,scale] duration-150 ease-out hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.985]"
    >
      <Avatar person={node.owner} size={30} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <StatusIcon status={node.status} size={12} />
          {node.key}
          <span className="font-sans">· {STAGE_LABEL[node.status]}</span>
        </span>
        <span className="mt-0.5 block truncate text-[13px] font-medium">
          {node.title}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-2">
          <Signal node={node} role={role} />
          <span className="truncate text-[11px] text-muted-foreground">
            {node.since}
          </span>
        </span>
      </span>
    </motion.button>
  );
}
