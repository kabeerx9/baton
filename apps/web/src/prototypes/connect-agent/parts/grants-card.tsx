import { BotIcon, RefreshCwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { Button } from "@/components/ui/button";
import type { GrantsList } from "../grants-state";
import { GrantRow } from "./grant-row";

type GrantsCardProps = {
  list: GrantsList;
  now: number;
  onRevoke: (grantId: string) => void;
  onRetry: () => void;
  /** Shown in the empty state under the title. */
  emptyHint?: ReactNode;
};

/** The one renderer for the list lifecycle. An unknown status renders as loading. */
export function GrantsCard({
  list,
  now,
  onRevoke,
  onRetry,
  emptyHint,
}: GrantsCardProps) {
  return (
    <SettingsCard aria-busy={list.status === "loading"}>
      {list.status === "ready" ? (
        list.grants.length === 0 ? (
          <SettingsEmpty
            icon={<BotIcon />}
            title="No agents connected yet"
            description={emptyHint ?? "Agents you sign in will show up here."}
          />
        ) : (
          list.grants.map((grant) => (
            <GrantRow
              key={grant.id}
              grant={grant}
              now={now}
              onRevoke={onRevoke}
            />
          ))
        )
      ) : list.status === "error" ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 px-4 py-3.5"
        >
          <p className="text-sm text-destructive-foreground">
            Could not load connected agents. Your agents still work.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCwIcon aria-hidden="true" />
            Retry
          </Button>
        </div>
      ) : (
        <SettingsRowsSkeleton rows={3} withDescription />
      )}
    </SettingsCard>
  );
}
