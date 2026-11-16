import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revokeMcpGrant } from "@/fetchers/mcp/revoke-grant";
import { MCP_GRANTS_KEY } from "@/hooks/queries/mcp/use-mcp-grants";

/** Revokes a grant, then refetches the list. The mutation stays pending until the list is fresh. */
export function useRevokeMcpGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeMcpGrant,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: MCP_GRANTS_KEY }),
  });
}
