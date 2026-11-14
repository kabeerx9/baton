import { Link } from "@tanstack/react-router";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { Avatar } from "../avatar";
import type { Lane, Subtask } from "../model";
import { StatusMenu } from "../status-menu";

export type TaskNodeData = {
  task: Subtask;
  lane: Lane | undefined;
  blocked: boolean;
  workspaceId: string;
};
export type TaskNode = Node<TaskNodeData, "task">;
export type RootNode = Node<
  { taskKey: string; title: string; done: number; total: number },
  "root"
>;

export const TASK_SIZE = { width: 262, height: 48 };
export const ROOT_SIZE = { width: 136, height: 136 };

const hidden = "!size-1 !border-0 !bg-transparent";

/** One task: a pill with its status, its title, its repo and its owner. */
export function TaskPill({ data }: NodeProps<TaskNode>) {
  const { task, lane, blocked, workspaceId } = data;
  const color = lane?.tone.stroke ?? "var(--border)";
  return (
    <div
      className={`relative flex cursor-pointer items-center gap-2 rounded-full border bg-card py-1.5 pr-2 pl-1.5 shadow-[0_1px_4px_rgb(0_0_0/0.08)] transition-[border-color,box-shadow] duration-150 ease-out hover:border-foreground/30 hover:shadow-[0_4px_14px_rgb(0_0_0/0.12)] ${
        blocked ? "border-amber-500/50" : "border-border"
      }`}
      style={{ width: TASK_SIZE.width }}
    >
      <Handle type="target" position={Position.Left} className={hidden} />
      <span
        className="nodrag relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `color-mix(in oklab, ${color} 16%, transparent)`,
        }}
      >
        <StatusMenu taskId={task.id} status={task.status} blocked={blocked} />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-[12.5px] leading-tight ${task.status === "done" ? "text-muted-foreground" : ""}`}
        >
          {task.title}
        </p>
        <p className="truncate text-[10.5px] text-muted-foreground">
          <span className={lane?.tone.text}>
            {lane?.general ? "No repo" : (lane?.name ?? "")}
          </span>{" "}
          <span className="font-mono">{task.key}</span>
          {task.pr ? ` · #${task.pr.number} ${task.pr.state}` : ""}
        </p>
      </div>
      <Avatar person={task.assignee} size={22} />
      {/* The whole pill opens the task. It sits under the status button, and
          without `nodrag` so that dragging the pill still moves the node. */}
      <Link
        to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
        params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
        aria-label={task.title}
        title={task.title}
        className="absolute inset-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Handle type="source" position={Position.Right} className={hidden} />
    </div>
  );
}

/** The feature itself: a circle with its progress. */
export function FeatureRoot({ data }: NodeProps<RootNode>) {
  const ratio = data.total ? data.done / data.total : 0;
  return (
    <div
      className="flex flex-col items-center justify-center rounded-full border border-foreground/20 bg-card p-3 text-center shadow-[0_8px_24px_rgb(0_0_0/0.14)]"
      style={ROOT_SIZE}
    >
      <p className="font-mono text-[10px] text-muted-foreground">
        {data.taskKey}
      </p>
      <p className="line-clamp-3 font-semibold text-[12.5px] leading-tight">
        {data.title}
      </p>
      <div className="mt-1.5 h-1 w-14 overflow-hidden rounded-full bg-border">
        <div
          className="h-full origin-left rounded-full bg-emerald-500 transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {data.done}/{data.total}
      </p>
      <Handle type="source" position={Position.Right} className={hidden} />
    </div>
  );
}
