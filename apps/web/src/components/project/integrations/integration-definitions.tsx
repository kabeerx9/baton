import type { ComponentType, SVGProps } from "react";
import { GithubIcon } from "@/components/icons/github-icon";
import { GitHubIntegrationSettings } from "@/components/project/github-integration/github-integration-settings";

export type IntegrationId = "github";

export type IntegrationDefinition = {
  id: IntegrationId;
  name: string;
  descriptionKey: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName: string;
  Settings: ComponentType<{ projectId: string }>;
};

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: "github",
    name: "GitHub",
    descriptionKey: "settings:projectIntegrations.githubSectionSubtitle",
    icon: GithubIcon,
    iconClassName: "text-foreground",
    Settings: GitHubIntegrationSettings,
  },
];
