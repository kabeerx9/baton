import { useMutation, useQueryClient } from "@tanstack/react-query";
import { joinWorkspace } from "@/fetchers/join-link/join-workspace";
import { authClient } from "@/lib/auth-client";

/**
 * Joins through the API, then makes the workspace active. The join does not
 * set the session's active workspace; the board route needs it.
 */
export function useJoinWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const result = await joinWorkspace(token);
      // The join is committed. A failed switch must not read as a failed join.
      await authClient.organization
        .setActive({ organizationId: result.workspace.id })
        .catch(() => undefined);
      return result;
    },
    onSuccess: async () => {
      // The tour gate and the workspace switcher read this list.
      authClient.$store.notify("$listOrg");
      authClient.$store.notify("$activeOrgSignal");
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}
