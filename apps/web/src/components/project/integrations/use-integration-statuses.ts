import {
  formatRepository,
  getIntegrationStatus,
} from "@/components/project/integrations/get-integration-status";
import type { IntegrationId } from "@/components/project/integrations/integration-definitions";
import useGetGithubIntegration from "@/hooks/queries/github-integration/use-get-github-integration";

// Shares query keys with the per-integration settings panels, so opening a
// panel reuses what the list already loaded.
export function useIntegrationStatuses(projectId: string) {
  const github = useGetGithubIntegration(projectId);

  const statuses = {
    github: getIntegrationStatus({
      queryStatus: github.status,
      hasData: github.data !== undefined,
      configured: Boolean(github.data),
      isActive: github.data?.isActive,
      detail: formatRepository(
        github.data?.repositoryOwner,
        github.data?.repositoryName,
      ),
    }),
  };
  const queries = { github };

  return {
    statuses,
    retry: (id: IntegrationId) => {
      void queries[id].refetch();
    },
  };
}
