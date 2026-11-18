import {
  type Edge,
  type NodeTypes,
  ReactFlow,
  type ReactFlowInstance,
  useNodesState,
} from "@xyflow/react";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  type BoardTask,
  isBlocked,
  type Lane,
  laneOf,
  type Subtask,
} from "../model";
import { layout } from "./graph-layout";
import { boundsOf, initialViewport, MIN_START_ZOOM } from "./initial-viewport";
import { mergeNodes } from "./merge-nodes";
import { TaskList } from "./task-list";
import {
  FeatureRoot,
  ROOT_SIZE,
  type RootNode,
  TASK_SIZE,
  type TaskNode,
  TaskPill,
} from "./stream-nodes";
import "@xyflow/react/dist/style.css";

const nodeTypes: NodeTypes = { task: TaskPill, root: FeatureRoot };

function StreamCanvas({
  feature,
  lanes,
  workspaceId,
}: {
  feature: BoardTask;
  lanes: Lane[];
  workspaceId: string;
}) {
  const tasks = feature.subtasks;

  // A task with nothing before it hangs off the feature. A link to a task
  // outside this feature is not drawn.
  const ids = new Set(tasks.map((t) => t.id));
  const inside = (t: Subtask) => t.blockedBy.filter((id) => ids.has(id));
  const links = tasks.flatMap((t) =>
    inside(t).length === 0
      ? [{ source: "root", target: t.id }]
      : inside(t).map((source) => ({ source, target: t.id })),
  );

  // Laid out once for this set of tasks and links. Dragging then keeps a
  // node where it was put, until the set changes.
  const [placed] = useState(() =>
    layout(
      [
        { id: "root", ...ROOT_SIZE },
        ...tasks.map((t) => ({ id: t.id, ...TASK_SIZE })),
      ],
      links,
      "LR",
      { rank: 72, node: 20 },
    ),
  );

  const canvas = useRef<HTMLDivElement>(null);
  // The start view keeps the text readable. A wide map starts on the feature
  // and is panned by dragging.
  const start = (flow: ReactFlowInstance<TaskNode | RootNode>) => {
    const box = canvas.current;
    if (!box) return;
    const sizes = new Map([
      ["root", ROOT_SIZE],
      ...tasks.map((t) => [t.id, TASK_SIZE] as const),
    ]);
    void flow.setViewport(
      initialViewport(boundsOf(placed, sizes), {
        width: box.clientWidth,
        height: box.clientHeight,
      }),
    );
  };

  const [nodes, setNodes, onNodesChange] = useNodesState<TaskNode | RootNode>(
    [],
  );
  useEffect(() => {
    // Only the data is new here. The node itself stays, so React Flow keeps
    // its measured size and the place it was dragged to instead of hiding it
    // until it measures the map again.
    const next: (TaskNode | RootNode)[] = [
      {
        id: "root",
        type: "root",
        position: placed.get("root") ?? { x: 0, y: 0 },
        data: {
          taskKey: feature.key,
          title: feature.title,
          done: tasks.filter((t) => t.status === "done").length,
          total: tasks.length,
        },
      },
      ...tasks.map((task) => ({
        id: task.id,
        type: "task" as const,
        position: placed.get(task.id) ?? { x: 0, y: 0 },
        data: {
          task,
          lane: laneOf(lanes, task.projectId),
          blocked: isBlocked(task),
          workspaceId,
        },
      })),
    ];
    setNodes((current) => mergeNodes(current, next));
  }, [tasks, lanes, placed, feature.key, feature.title, workspaceId, setNodes]);

  const edges: Edge[] = links.map((link) => {
    const blocker = tasks.find((t) => t.id === link.source);
    const fromRoot = link.source === "root";
    const waiting = blocker ? blocker.status !== "done" : false;
    return {
      id: `${link.source}-${link.target}`,
      source: link.source,
      target: link.target,
      // Moving dashes mean "still waiting". A finished blocker is a still line.
      animated: waiting,
      style: {
        stroke: fromRoot
          ? "var(--border)"
          : waiting
            ? "var(--color-amber-500)"
            : "var(--color-emerald-500)",
        strokeWidth: fromRoot ? 1.25 : 1.75,
        opacity: fromRoot ? 0.9 : 0.75,
      },
    };
  });

  const dark = document.documentElement.classList.contains("dark");

  return (
    <div
      ref={canvas}
      className="w-full overflow-hidden rounded-2xl border border-border bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:16px_16px]"
      style={{ height: Math.min(600, Math.max(300, 120 + tasks.length * 64)) }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        colorMode={dark ? "dark" : "light"}
        onInit={start}
        minZoom={MIN_START_ZOOM / 2}
        maxZoom={1.5}
        nodesConnectable={false}
        preventScrolling={false}
        zoomOnScroll={false}
        style={{ background: "transparent" }}
      />
    </div>
  );
}

/**
 * A feature's tasks as a map that reads left to right: the feature, then what
 * can start now, then what waits on it. Each task is a pill of its own: point
 * at it to see it stand out, click it to open it.
 */
export function TaskStream({
  feature,
  lanes,
  workspaceId,
  onAdd,
}: {
  feature: BoardTask;
  lanes: Lane[];
  workspaceId: string;
  /** Absent for people who cannot create tasks: the Add button is hidden. */
  onAdd?: () => void;
}) {
  const tasks = feature.subtasks;
  const done = tasks.filter((t) => t.status === "done").length;
  // The map needs room. A phone gets the same tasks as a list.
  const narrow = useIsMobile();
  // A new task or a new link changes the shape, so the map is laid out again.
  const shape = tasks.map((t) => `${t.id}:${t.blockedBy.join(",")}`).join("|");

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="font-medium text-sm">Tasks</h2>
        {tasks.length > 0 && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {done} of {tasks.length} done
          </span>
        )}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground text-xs outline-none transition-colors duration-150 ease-out hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-3.5" />
            Add task
          </button>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          None. This is a single task. Add a task under it when a piece belongs
          to another person or repo; it then becomes a feature.
        </p>
      ) : narrow ? (
        <TaskList tasks={tasks} lanes={lanes} workspaceId={workspaceId} />
      ) : (
        <StreamCanvas
          key={shape}
          feature={feature}
          lanes={lanes}
          workspaceId={workspaceId}
        />
      )}
    </section>
  );
}
