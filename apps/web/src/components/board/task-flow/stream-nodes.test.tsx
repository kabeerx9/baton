import type { NodeProps } from "@xyflow/react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Subtask } from "../model";
import { TaskPill, type TaskNode } from "./stream-nodes";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right" },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    ...rest
  }: {
    to: string;
    params: Record<string, string>;
  }) => (
    // oxlint-disable-next-line jsx-a11y/anchor-has-content -- the pill's link is named by aria-label
    <a
      href={Object.entries(params).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}
      {...rest}
    />
  ),
}));

vi.mock("../status-menu", () => ({
  StatusMenu: ({ taskId }: { taskId: string }) => (
    <button type="button" aria-label={`Status of ${taskId}`} />
  ),
}));

const task: Subtask = {
  id: "t1",
  key: "API-1",
  title: "Fix login crash",
  projectId: "p1",
  status: "todo",
  priority: null,
  dueDate: null,
  finishedAt: null,
  assignee: null,
  pr: null,
  blockedBy: [],
  pendingRequest: null,
  move: "apply",
  waitsOn: [],
  hiddenBlockers: 0,
};

function renderPill() {
  const data = { task, lane: undefined, blocked: false, workspaceId: "w1" };
  return render(<TaskPill {...({ data } as NodeProps<TaskNode>)} />);
}

afterEach(cleanup);

describe("TaskPill", () => {
  it("opens the task wherever the pill is clicked", () => {
    renderPill();
    const link = screen.getByRole("link", { name: "Fix login crash" });
    expect(link.getAttribute("href")).toBe(
      "/dashboard/workspace/w1/project/p1/task/t1",
    );
    // The link covers the pill instead of wrapping its text alone.
    expect(link.className).toContain("absolute");
    expect(link.className).toContain("inset-0");
  });

  it("keeps the status button outside the link and above it", () => {
    renderPill();
    const button = screen.getByRole("button", { name: "Status of t1" });
    const link = screen.getByRole("link", { name: "Fix login crash" });
    expect(link.contains(button)).toBe(false);
    expect(button.parentElement?.className).toContain("z-10");
  });
});
