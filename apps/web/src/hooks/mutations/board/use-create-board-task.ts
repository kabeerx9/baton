import { useMutation, useQueryClient } from "@tanstack/react-query";
import createBoardTask from "@/fetchers/board/create-board-task";

export function useCreateBoardTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBoardTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-board"] });
    },
  });
}
