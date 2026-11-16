import type { GitHubConfig } from "../github/config";
import {
  formatIssueBody,
  formatTaskDescriptionFromIssue,
} from "../github/utils/format";
import { getVerifiedInstallationOctokit } from "../github/utils/github-app";
import { isDemoProject } from "../../workspace/kind/is-demo-workspace";

export type IssueValues = {
  title: string;
  description: string;
  state: "open" | "closed";
};

export async function providerIssue(
  integration: { type: string; config: string; projectId: string },
  link: { externalId: string; taskId: string },
) {
  // The write boundary of every explicit sync: a demo never reaches GitHub.
  if (await isDemoProject(integration.projectId))
    throw new Error("Integrations do not act in a demo workspace");
  const number = Number(link.externalId);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new Error("Invalid issue number");
  const config = JSON.parse(integration.config);
  const owner = config.repositoryOwner;
  const repo = config.repositoryName;
  const normalize = (issue: {
    title: string;
    body?: string | null;
    state: string;
    updated_at?: string;
    labels?: Array<string | { name?: string }>;
  }) => ({
    title: issue.title,
    description: formatTaskDescriptionFromIssue(issue.body ?? "", link.taskId),
    state: issue.state === "closed" ? ("closed" as const) : ("open" as const),
    updatedAt: issue.updated_at ?? null,
    labels: (issue.labels ?? []).flatMap((label) => {
      const name = typeof label === "string" ? label : label.name;
      return name ? [name] : [];
    }),
  });
  const octokit = await getVerifiedInstallationOctokit(
    config as GitHubConfig,
    true,
  );
  return {
    read: async () =>
      normalize(
        (
          await octokit.rest.issues.get({
            owner,
            repo,
            issue_number: number,
            request: { timeout: 10_000 },
          })
        ).data,
      ),
    write: async (values: IssueValues) =>
      normalize(
        (
          await octokit.rest.issues.update({
            owner,
            repo,
            issue_number: number,
            title: values.title,
            body: formatIssueBody(values.description, link.taskId),
            state: values.state,
            request: { timeout: 10_000 },
          })
        ).data,
      ),
  };
}
