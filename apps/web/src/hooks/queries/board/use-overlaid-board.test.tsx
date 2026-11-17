import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { BoardResponse } from "@/fetchers/board/get-board";
import { dispatchStatus } from "@/store/task-status/store";
import { useOverlaidBoard } from "./use-overlaid-board";

const board = (status: string, statusGeneration: number, column = "todo") =>
  ({
    tasks: [
      {
        id: "a",
        status,
        isCompleted: false,
        finishedAt: null,
        statusGeneration,
        statusChange: { move: "apply" },
        column,
        subtasks: [],
      },
    ],
  }) as never as BoardResponse;

const column = (data: BoardResponse | undefined) => data?.tasks[0]?.column;

describe("useOverlaidBoard", () => {
  it("keeps the shown status when a realtime refetch lands during a write", () => {
    const { result, rerender } = renderHook(
      ({ data }) => useOverlaidBoard(data),
      { initialProps: { data: board("to-do", 3) } },
    );
    expect(column(result.current)).toBe("todo");

    act(() => {
      dispatchStatus("a", {
        type: "chosen",
        target: { status: "in-progress", isFinal: false },
        move: "apply",
      });
    });
    expect(column(result.current)).toBe("doing");

    // The socket invalidated the board; the refetch still has the old status.
    rerender({ data: board("to-do", 3) });
    expect(column(result.current)).toBe("doing");
  });

  it("shows the acknowledged target until a read reaches its generation, then the server", () => {
    const { result, rerender } = renderHook(
      ({ data }) => useOverlaidBoard(data),
      { initialProps: { data: board("to-do", 3) } },
    );
    act(() => {
      dispatchStatus("a", {
        type: "chosen",
        target: { status: "in-progress", isFinal: false },
        move: "apply",
      });
      dispatchStatus("a", { type: "applied", generation: 4 });
    });
    rerender({ data: board("to-do", 3) });
    expect(column(result.current)).toBe("doing");

    rerender({ data: board("in-review", 5, "review") });
    expect(column(result.current)).toBe("review");
  });

  it("passes no data through", () => {
    const { result } = renderHook(() => useOverlaidBoard(undefined));
    expect(result.current).toBeUndefined();
  });
});
