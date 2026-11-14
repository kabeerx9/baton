import type { QueryClient } from "@tanstack/react-query";

/** The board and every relation list that a new link can change. */
export function refreshAfterLink(client: QueryClient, taskIds: string[]) {
  void client.invalidateQueries({ queryKey: ["task-board"] });
  for (const id of taskIds) {
    void client.invalidateQueries({
      queryKey: ["task-relations", id],
      refetchType: "all",
    });
  }
  void client.invalidateQueries({ queryKey: ["task-relations", "project"] });
}
