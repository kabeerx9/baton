import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type CreateWorkspaceBody,
  createWorkspace,
} from "@/fetchers/workspace/create-workspace";
import {
  WORKSPACES_QUERY_KEY,
  workspaceQueryKey,
} from "./workspace-query-keys";

/** The caller opens the new workspace by navigating to its route. */
function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: CreateWorkspaceBody) =>
      createWorkspace({
        name: name.trim(),
        description: description?.trim() || undefined,
      }),
    onSuccess: async (workspace) => {
      queryClient.setQueryData(workspaceQueryKey(workspace.id), workspace);
      await queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
    },
  });
}

export default useCreateWorkspace;
