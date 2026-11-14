import type { ComponentType, SVGProps } from "react";
import { GithubIcon } from "@/components/icons/github-icon";

export type RepositoryProviderId = "github";

export type RepositoryProvider = {
  id: RepositoryProviderId;
  name: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName: string;
};

export const REPOSITORY_PROVIDERS: RepositoryProvider[] = [
  {
    id: "github",
    name: "GitHub",
    icon: GithubIcon,
    iconClassName: "text-foreground",
  },
];
