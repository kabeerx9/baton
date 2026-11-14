import { useMutation, useQueryClient } from "@tanstack/react-query";
import decideChangeRequest, {
  type Decision,
} from "@/fetchers/task-change-request/decide-change-request";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import { changeRequestKey } from "../../queries/task-change-request/use-get-change-request";

/**
 * Accept, reject or cancel one request. Nothing is changed locally: the server
 * decides, and every view that shows the task or its request reloads after.
 */
export function useDecideChangeRequest(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: Decision }) =>
      decideChangeRequest(id, decision),
    onSettled: (_data, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: changeRequestKey(id) });
      void queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      void queryClient.invalidateQueries({ queryKey: ["task-board"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["activities", taskId] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      invalidateMyWork(queryClient);
    },
  });
}
