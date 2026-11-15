import { useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsSection } from "@/components/settings/settings-section";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { CLIENTS } from "../clients";
import { instanceFor } from "../instance";
import { AgentsNote } from "../parts/agents-note";
import { GrantsCard } from "../parts/grants-card";
import { InstanceNotice } from "../parts/instance-notice";
import { RevokeDialog } from "../parts/revoke-dialog";
import { SetupSteps } from "../parts/setup-steps";
import { TryIt } from "../parts/try-it";
import { UrlLine } from "../parts/url-line";
import type { ClientId } from "../types";
import { useGrants } from "../use-grants";
import type { VariantProps } from "./variant-props";

// Axis: setup first. One card, one client at a time, tabs pick the client.
export function FocusVariant({ scenario }: VariantProps) {
  const instance = instanceFor(scenario);
  const { state, dispatch, retry, confirmRevoke } = useGrants(scenario);
  const [client, setClient] = useState<ClientId>("claude-code");
  const [now] = useState(() => Date.now());

  return (
    <SettingsPage
      title="Connect an agent"
      description="Add Baton to your agent once. It signs in through your browser, so there is no key to paste."
    >
      <div className="proto-enter space-y-3">
        <InstanceNotice kind={instance.kind} />
        <SettingsCard>
          <div className="p-4 sm:p-5">
            <Tabs
              value={client}
              onValueChange={(value) => setClient(value as ClientId)}
            >
              <TabsList
                aria-label="Agent"
                className="max-w-full overflow-x-auto"
              >
                {CLIENTS.map((c) => (
                  <TabsTab key={c.id} value={c.id}>
                    {c.name}
                  </TabsTab>
                ))}
              </TabsList>
              {CLIENTS.map((c) => (
                <TabsPanel key={c.id} value={c.id}>
                  <div className="space-y-5 pt-3">
                    <UrlLine url={instance.url} />
                    <SetupSteps
                      client={c.id}
                      url={instance.url}
                      kind={instance.kind}
                    />
                  </div>
                </TabsPanel>
              ))}
            </Tabs>
          </div>
        </SettingsCard>
        <TryIt />
      </div>

      <SettingsSection
        title="Connected agents"
        description="Agents signed in as you. Revoke one to sign it out."
        className="proto-enter"
      >
        <GrantsCard
          list={state.list}
          now={now}
          onRevoke={(grantId) => dispatch({ type: "ask-revoke", grantId })}
          onRetry={retry}
          emptyHint="Set one up above. It appears here after you sign in."
        />
        <AgentsNote />
      </SettingsSection>

      <RevokeDialog
        state={state}
        onCancel={() => dispatch({ type: "cancel-revoke" })}
        onConfirm={confirmRevoke}
      />
    </SettingsPage>
  );
}
