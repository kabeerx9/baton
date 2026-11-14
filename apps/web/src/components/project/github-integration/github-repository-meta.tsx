import { useTranslation } from "react-i18next";
import type { GithubRepository } from "@/fetchers/github-integration/list-repositories";
import { formatRelativeTime } from "@/lib/format";

type GithubRepositoryMetaProps = {
  repository: GithubRepository;
};

export function GithubRepositoryMeta({
  repository,
}: GithubRepositoryMetaProps) {
  const { t, i18n } = useTranslation();
  const updated = repository.updated_at
    ? t("settings:repositoryBrowser.updated", {
        time: formatRelativeTime(repository.updated_at, i18n.language),
      })
    : null;

  return <>{[repository.description, updated].filter(Boolean).join(" · ")}</>;
}
