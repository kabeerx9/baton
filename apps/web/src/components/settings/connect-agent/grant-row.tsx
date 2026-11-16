import { BotIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { StatusBadge } from "@/components/settings/status-badge";
import { Button } from "@/components/ui/button";
import type { McpGrant } from "@/fetchers/mcp/list-grants";
import { formatRelativeTime } from "@/lib/format";
import { isStale } from "./grants-view";

type GrantRowProps = {
  grant: McpGrant;
  now: number;
  onRevoke: (grantId: string) => void;
};

export function GrantRow({ grant, now, onRevoke }: GrantRowProps) {
  const { t } = useTranslation();
  const ago = (iso: string) =>
    formatRelativeTime(iso, undefined, new Date(now));

  return (
    <SettingsRow
      icon={<BotIcon />}
      title={grant.clientName}
      badge={
        isStale(grant.lastUsedAt, now) ? (
          <StatusBadge tone="warning">
            {t("settings:connectAgent.grants.stale")}
          </StatusBadge>
        ) : undefined
      }
      description={t("settings:connectAgent.grants.details", {
        workspace:
          grant.workspace?.name ??
          t("settings:connectAgent.grants.noWorkspace"),
        used: ago(grant.lastUsedAt),
        connected: ago(grant.createdAt),
      })}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t("settings:connectAgent.grants.revokeLabel", {
          name: grant.clientName,
        })}
        onClick={() => onRevoke(grant.id)}
      >
        {t("settings:connectAgent.grants.revoke")}
      </Button>
    </SettingsRow>
  );
}
