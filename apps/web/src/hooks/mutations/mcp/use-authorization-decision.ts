import { useMutation } from "@tanstack/react-query";
import { submitMcpAuthorizationDecision } from "@/fetchers/mcp/submit-authorization-decision";
import { toast } from "@/lib/toast";

export function useMcpAuthorizationDecision() {
  return useMutation({
    mutationFn: ({
      requestId,
      approved,
      workspaceId,
    }: {
      requestId: string;
      approved: boolean;
      workspaceId?: string;
    }) => submitMcpAuthorizationDecision(requestId, approved, workspaceId),
    onError: (error) => toast.error(error.message),
  });
}
