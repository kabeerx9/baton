import { BotIcon, RefreshCwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { Button } from "@/components/ui/button";
import { GrantRow } from "./grant-row";
import type { GrantsView } from "./grants-view";

type GrantsCardProps = {
  view: GrantsView;
  now: number;
  onRevoke: (grantId: string) => void;
  onRetry: () => void;
  onShowMore: () => void;
};

/** The one renderer for the list view. An unknown status renders as loading. */
export function GrantsCard({
  view,
  now,
  onRevoke,
  onRetry,
  onShowMore,
}: GrantsCardProps) {
  const { t } = useTranslation();

  return (
    <SettingsCard
      aria-busy={view.status !== "ready" && view.status !== "error"}
    >
      {view.status === "ready" ? (
        view.grants.length === 0 ? (
          <SettingsEmpty
            icon={<BotIcon />}
            title={t("settings:connectAgent.grants.emptyTitle")}
            description={t("settings:connectAgent.grants.emptyDescription")}
          />
        ) : (
          <>
            {view.grants.map((grant) => (
              <GrantRow
                key={grant.id}
                grant={grant}
                now={now}
                onRevoke={onRevoke}
              />
            ))}
            {view.loadMoreFailed ? (
              <p
                role="alert"
                className="px-4 py-3 text-sm text-destructive-foreground"
              >
                {t("settings:connectAgent.grants.loadMoreError")}
              </p>
            ) : null}
            {view.hasMore ? (
              <div className="flex justify-center px-4 py-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={view.loadingMore}
                  onClick={onShowMore}
                >
                  {view.loadingMore
                    ? t("settings:connectAgent.grants.loadingMore")
                    : t("settings:connectAgent.grants.showMore")}
                </Button>
              </div>
            ) : null}
          </>
        )
      ) : view.status === "error" ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 px-4 py-3.5"
        >
          <p className="text-sm text-destructive-foreground">
            {t("settings:connectAgent.grants.loadError")}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCwIcon aria-hidden="true" />
            {t("settings:connectAgent.grants.retry")}
          </Button>
        </div>
      ) : (
        <SettingsRowsSkeleton rows={3} withDescription />
      )}
    </SettingsCard>
  );
}
