import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { CLIENTS } from "./clients";
import type { Instance } from "./instance";
import { SetupSteps } from "./setup-steps";
import type { ClientId } from "./types";
import { UrlLine } from "./url-line";

/** One card, one client at a time. The tabs pick the client. */
export function SetupCard({ instance }: { instance: Instance }) {
  const { t } = useTranslation();
  const [client, setClient] = useState<ClientId>("claude-code");

  return (
    <SettingsCard>
      <div className="p-4 sm:p-5">
        <Tabs
          value={client}
          onValueChange={(value) => setClient(value as ClientId)}
        >
          <TabsList
            aria-label={t("settings:connectAgent.clientsLabel")}
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
  );
}
