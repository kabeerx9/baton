import { CheckIcon } from "lucide-react";
import { motion } from "motion/react";
import { Avatar } from "@/components/board/avatar";
import { StatusIcon } from "@/components/board/status-icon";
import { STAGE_LABEL } from "../../copy";
import { TONE_CLASS, STATUS_TONE } from "../../tone";
import type { Linked } from "../../types";
import { NODE_H } from "./relay-geometry";

/** What a node says about its relation to the core. */
export type NodeRole =
  | { kind: "blocker" }
  | { kind: "dependent"; coreDone: boolean };

function Badge({ node, role }: { node: Linked; role: NodeRole }) {
  if (role.kind === "blocker") {
    return node.status === "done" ? (
      <span
        className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-medium ${TONE_CLASS.emerald.soft}`}
      >
        <CheckIcon className="size-3" aria-hidden="true" />
        Done
      </span>
    ) : (
      <span
        className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-medium ${TONE_CLASS.amber.soft}`}
      >
        <span className="proto-breathe size-1.5 rounded-full bg-amber-500" />
        Holding this up
      </span>
    );
  }
  if (node.status === "done") {
    return <span className="text-[11px] text-muted-foreground">Finished</span>;
  }
  if (!role.coreDone) {
    return (
      <span className="shrink-0 text-[11px] text-muted-foreground">
        Waiting
      </span>
    );
  }
  if ((node.otherBlockers ?? 0) > 0) {
    return (
      <span className="text-[11px] text-muted-foreground">
        Also waits on {node.otherBlockers} more
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-medium ${TONE_CLASS.emerald.soft}`}
    >
      <span className="proto-breathe size-1.5 rounded-full bg-emerald-500" />
      Can continue
    </span>
  );
}

export function RelayNode({
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
  const tone = TONE_CLASS[STATUS_TONE[node.status]];
  const hot =
    (role.kind === "blocker" && node.status !== "done") ||
    (role.kind === "dependent" &&
      role.coreDone &&
      node.status !== "done" &&
      (node.otherBlockers ?? 0) === 0);
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, x: align === "left" ? -10 : 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.3,
        ease: [0.23, 1, 0.32, 1],
        delay: 0.08 + index * 0.06,
      }}
      style={{ height: NODE_H }}
      className={`group relative flex w-full items-center text-left gap-3 rounded-2xl border bg-card/80 px-3.5 backdrop-blur transition-[border-color,box-shadow,transform] duration-150 ease-out hover:border-foreground/25 active:scale-[0.985] ${
        hot
          ? `${tone.border} ${role.kind === "blocker" ? TONE_CLASS.amber.border : TONE_CLASS.emerald.border}`
          : "border-border"
      }`}
    >
      <Avatar person={node.owner} size={32} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <StatusIcon status={node.status} size={12} />
          {node.key}
          <span aria-hidden="true">·</span>
          <span className="font-sans">{STAGE_LABEL[node.status]}</span>
        </span>
        <span className="mt-0.5 block truncate text-[13px] font-medium leading-snug">
          {node.title}
        </span>
        <span className="mt-1 flex min-w-0 items-center gap-2">
          <Badge node={node} role={role} />
          <span className="truncate text-[11px] text-muted-foreground">
            {node.owner ? node.owner.name.split(" ")[0] : "No owner"} ·{" "}
            {node.since}
          </span>
        </span>
      </span>
    </motion.button>
  );
}
