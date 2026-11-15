import { BotIcon } from "lucide-react";
import { SettingsRow } from "@/components/settings/settings-row";
import { StatusBadge } from "@/components/settings/status-badge";
import { Button } from "@/components/ui/button";
import { formatAgo, isStale } from "../time";
import type { McpGrant } from "../types";

type GrantRowProps = {
  grant: McpGrant;
  now: number;
  onRevoke: (grantId: string) => void;
};

export function GrantRow({ grant, now, onRevoke }: GrantRowProps) {
  const stale = isStale(grant.lastUsedAt, grant.createdAt, now);
  const used = grant.lastUsedAt
    ? `Used ${formatAgo(grant.lastUsedAt, now)}`
    : "Never used";
  const where = grant.workspace?.name ?? "Any workspace";

  return (
    <SettingsRow
      icon={<BotIcon />}
      title={grant.clientName}
      badge={
        stale ? <StatusBadge tone="warning">Stale</StatusBadge> : undefined
      }
      description={`${where} · ${used} · Connected ${formatAgo(grant.createdAt, now)}`}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Revoke ${grant.clientName}`}
        onClick={() => onRevoke(grant.id)}
      >
        Revoke
      </Button>
    </SettingsRow>
  );
}
