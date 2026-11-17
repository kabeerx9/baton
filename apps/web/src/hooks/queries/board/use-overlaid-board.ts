import { useMemo } from "react";
import { overlayBoard } from "@/components/board/status-overlay";
import type { BoardResponse } from "@/fetchers/board/get-board";
import { useTaskStatusStore } from "@/store/task-status/store";

/** The board read with the status writes in flight laid over it. Views read this, not the raw read. */
export function useOverlaidBoard(data: BoardResponse | undefined) {
  const entries = useTaskStatusStore((state) => state.entries);
  return useMemo(
    () =>
      data ? overlayBoard(data, entries, new Date().toISOString()) : undefined,
    [data, entries],
  );
}
