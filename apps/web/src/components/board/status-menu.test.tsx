import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import { dispatchStatus } from "@/store/task-status/store";
import type { Move } from "@/store/task-status/types";
import { StatusMenu } from "./status-menu";

vi.mock("@/fetchers/task/update-task-status", () => ({ default: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), info: vi.fn() } }));

const put = vi.mocked(updateTaskStatus);

beforeEach(() => {
  vi.clearAllMocks();
  put.mockResolvedValue({
    outcome: "applied",
    task: { id: "t", statusGeneration: 4 },
  } as never);
});

function renderMenu(move: Move, blocked = false) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <StatusMenu taskId="t" status="todo" move={move} blocked={blocked} />
    </QueryClientProvider>,
  );
}

const trigger = () => screen.getByRole("button", { name: /Change status/ });

describe("StatusMenu", () => {
  it("writes the chosen column slug, saying the target is final for Done", async () => {
    renderMenu("apply");
    fireEvent.click(trigger());
    fireEvent.click(await screen.findByRole("menuitem", { name: /In review/ }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0]![1]).toEqual({ status: "in-review" });
  });

  it("is disabled when the server denies the move", () => {
    renderMenu("deny");
    expect(trigger()).toBeDisabled();
  });

  it("is disabled while another control holds the task", () => {
    renderMenu("apply");
    expect(trigger()).toBeEnabled();
    dispatchStatus("t", {
      type: "chosen",
      target: { status: "done", isFinal: true },
      move: "request",
    });
    return waitFor(() => expect(trigger()).toBeDisabled());
  });

  it("keeps Done disabled, with its reason, while the task is blocked", async () => {
    renderMenu("apply", true);
    fireEvent.click(trigger());
    expect(
      await screen.findByRole("menuitem", { name: /Done · blocked/ }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});
