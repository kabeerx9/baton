import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsSection } from "@/components/settings/settings-section";
import { useMcpGrants } from "@/hooks/queries/mcp/use-mcp-grants";
import { AgentsNote } from "./agents-note";
import { GrantsCard } from "./grants-card";
import { deriveGrantsView } from "./grants-view";
import { mcpInstance } from "./instance";
import { InstanceNotice } from "./instance-notice";
import { RevokeDialog } from "./revoke-dialog";
import { SetupCard } from "./setup-card";
import { TryIt } from "./try-it";
import { useRevokeFlow } from "./use-revoke-flow";

export function ConnectAgentSettings() {
  const { t } = useTranslation();
  const [instance] = useState(() => mcpInstance(window.location.origin));
  const [now] = useState(() => Date.now());
  const grantsQuery = useMcpGrants();
  const view = deriveGrantsView(grantsQuery);
  const { flow, ask, cancel, confirm } = useRevokeFlow();
  const pending =
    view.status === "ready" && flow.status !== "idle"
      ? (view.grants.find((g) => g.id === flow.grantId) ?? null)
      : null;

  return (
    <SettingsPage
      title={t("settings:connectAgent.title")}
      description={t("settings:connectAgent.subtitle")}
    >
      <div className="space-y-3">
        <InstanceNotice kind={instance.kind} />
        <SetupCard instance={instance} />
        <TryIt />
      </div>

      <SettingsSection
        title={t("settings:connectAgent.grants.title")}
        description={t("settings:connectAgent.grants.description")}
      >
        <GrantsCard
          view={view}
          now={now}
          onRevoke={ask}
          onRetry={() => void grantsQuery.refetch()}
          onShowMore={() => void grantsQuery.fetchNextPage()}
        />
        <AgentsNote />
      </SettingsSection>

      <RevokeDialog
        flow={flow}
        grant={pending}
        onCancel={cancel}
        onConfirm={confirm}
      />
    </SettingsPage>
  );
}
