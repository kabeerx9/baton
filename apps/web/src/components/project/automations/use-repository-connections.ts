import {
  formatRepository,
  getIntegrationStatus,
  type IntegrationStatus,
} from "@/components/project/integrations/get-integration-status";
import {
  REPOSITORY_PROVIDERS,
  type RepositoryProvider,
} from "@/components/project/automations/repository-providers";
import useGetGithubIntegration from "@/hooks/queries/github-integration/use-get-github-integration";

export type RepositoryConnection = RepositoryProvider & {
  status: IntegrationStatus;
};

export function useRepositoryConnections(
  projectId: string,
): RepositoryConnection[] {
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

  return REPOSITORY_PROVIDERS.map((provider) => ({
    ...provider,
    status: statuses[provider.id],
  }));
}
