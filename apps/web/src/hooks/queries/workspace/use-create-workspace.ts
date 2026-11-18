import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type CreateWorkspaceBody,
  createWorkspace,
} from "@/fetchers/workspace/create-workspace";
import { WORKSPACES_QUERY_KEY } from "./workspace-query-keys";

/** The caller opens the new workspace by navigating to its route. */
function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: CreateWorkspaceBody) =>
      createWorkspace({
        name: name.trim(),
        description: description?.trim() || undefined,
      }),
    // The route reads the new workspace itself; the 201 body is not
    // trusted to carry the caller's role.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY }),
  });
}

export default useCreateWorkspace;
