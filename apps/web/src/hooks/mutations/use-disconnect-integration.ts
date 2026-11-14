import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { IntegrationId } from "@/components/project/integrations/integration-definitions";
import deleteGithubIntegration from "@/fetchers/github-integration/delete-github-integration";

const disconnect = {
  github: deleteGithubIntegration,
};

export function useDisconnectIntegration(id: IntegrationId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      await disconnect[id](projectId);
    },
    onSuccess: (_, projectId) => {
      void queryClient.invalidateQueries({
        queryKey: [`${id}-integration`, projectId],
      });
    },
  });
}
