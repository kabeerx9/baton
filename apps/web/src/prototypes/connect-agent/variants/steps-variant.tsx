import { CheckIcon } from "lucide-react";
import { type ReactNode, useReducer, useState } from "react";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsSection } from "@/components/settings/settings-section";
import { Toggle, ToggleGroup } from "@/components/ui/toggle-group";
import { CLIENTS } from "../clients";
import { connectFlowReducer } from "../connect-flow";
import { makeConnectedGrant } from "../fixtures";
import { instanceFor } from "../instance";
import { AgentsNote } from "../parts/agents-note";
import { CodeBlock } from "../parts/code-block";
import { GrantsCard } from "../parts/grants-card";
import { InstanceNotice } from "../parts/instance-notice";
import { KeysLink } from "../parts/keys-link";
import { RevokeDialog } from "../parts/revoke-dialog";
import { buildSetup } from "../setup";
import type { ClientId } from "../types";
import { useGrants } from "../use-grants";
import { ConfirmStep } from "./confirm-step";
import { RailStep } from "./rail-step";
import type { VariantProps } from "./variant-props";

// Axis: guided flow. A numbered rail ends in a live "did it connect?" step.
export function StepsVariant({ scenario }: VariantProps) {
  const instance = instanceFor(scenario);
  const { state, dispatch, retry, confirmRevoke } = useGrants(scenario);
  const [client, setClient] = useState<ClientId>("claude-code");
  const [flow, flowDispatch] = useReducer(connectFlowReducer, {
    status: "waiting",
  });
  const [now] = useState(() => Date.now());

  const clientName = CLIENTS.find((c) => c.id === client)?.name ?? "Your agent";
  const steps = buildSetup(client, instance.url, instance.kind);
  const listReady = state.list.status === "ready";

  const pick = (next: ClientId) => {
    setClient(next);
    flowDispatch({ type: "reset" });
  };

  // Stands in for polling GET /api/mcp/grants: a real sign-in shows up in the list.
  const simulateSignIn = () => {
    flowDispatch({ type: "sign-in-seen" });
    setTimeout(() => {
      dispatch({
        type: "connected",
        grant: makeConnectedGrant(client, Date.now()),
      });
      flowDispatch({ type: "list-updated" });
    }, 900);
  };

  const rail: { title: string; body?: ReactNode }[] = [
    {
      title: "Choose your agent",
      body: (
        <div className="space-y-3">
          <ToggleGroup
            aria-label="Agent"
            variant="outline"
            size="sm"
            className="flex-wrap"
            value={[client]}
            onValueChange={(value) => {
              const next = value[0] as ClientId | undefined;
              if (next) pick(next);
            }}
          >
            {CLIENTS.map((c) => (
              <Toggle key={c.id} value={c.id} aria-label={c.name}>
                {c.name}
              </Toggle>
            ))}
          </ToggleGroup>
          <InstanceNotice kind={instance.kind} />
          <CodeBlock code={{ text: instance.url }} what="MCP URL" />
        </div>
      ),
    },
    ...steps.map((step) => ({
      title: step.title,
      body: (
        <div className="space-y-2">
          {step.body ? (
            <p className="text-sm text-muted-foreground">{step.body}</p>
          ) : null}
          {step.keysLink ? (
            <p className="text-sm text-muted-foreground">
              <KeysLink />
            </p>
          ) : null}
          {step.code ? (
            <CodeBlock code={step.code} what={step.title.toLowerCase()} />
          ) : null}
        </div>
      ),
    })),
    {
      title: "Check that it works",
      body: (
        <ConfirmStep
          flow={flow}
          clientName={clientName}
          canSimulate={listReady}
          onSimulate={simulateSignIn}
        />
      ),
    },
  ];

  return (
    <SettingsPage
      title="Connect an agent"
      description="Pick your agent and follow the steps. When it signs in, it shows up on this page."
    >
      <ol className="proto-enter">
        {rail.map((step, index) => (
          <RailStep
            key={step.title}
            index={index + 1}
            title={step.title}
            last={index === rail.length - 1}
            done={index === rail.length - 1 && flow.status === "connected"}
            doneIcon={<CheckIcon aria-hidden="true" />}
          >
            {step.body}
          </RailStep>
        ))}
      </ol>

      <SettingsSection
        title="Connected agents"
        description="Agents signed in as you. Revoke one to sign it out."
      >
        <GrantsCard
          list={state.list}
          now={now}
          onRevoke={(grantId) => dispatch({ type: "ask-revoke", grantId })}
          onRetry={retry}
          emptyHint="Finish the steps above. Your agent appears here."
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
