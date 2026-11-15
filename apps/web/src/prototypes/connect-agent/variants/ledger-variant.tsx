import { PlusIcon } from "lucide-react";
import { useRef, useState } from "react";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsSection } from "@/components/settings/settings-section";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { CLIENTS } from "../clients";
import { instanceFor } from "../instance";
import { AgentsNote } from "../parts/agents-note";
import { GrantsCard } from "../parts/grants-card";
import { InstanceNotice } from "../parts/instance-notice";
import { RevokeDialog } from "../parts/revoke-dialog";
import { SetupSteps } from "../parts/setup-steps";
import { TryIt } from "../parts/try-it";
import { UrlLine } from "../parts/url-line";
import { useGrants } from "../use-grants";
import type { VariantProps } from "./variant-props";

// Axis: agents first. The list is the hero. Setup is a reference you open on demand.
export function LedgerVariant({ scenario }: VariantProps) {
  const instance = instanceFor(scenario);
  const { state, dispatch, retry, confirmRevoke } = useGrants(scenario);
  const [now] = useState(() => Date.now());
  const addRef = useRef<HTMLElement>(null);
  const startEmpty =
    state.list.status === "ready" && state.list.grants.length === 0;
  const [open, setOpen] = useState<string[]>(startEmpty ? ["claude-code"] : []);

  const addAgent = () => {
    setOpen((current) => (current.length ? current : ["claude-code"]));
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    addRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  };

  const addButton = (
    <Button type="button" variant="outline" size="sm" onClick={addAgent}>
      <PlusIcon aria-hidden="true" />
      Add an agent
    </Button>
  );

  const count = state.list.status === "ready" ? state.list.grants.length : null;

  return (
    <SettingsPage
      title="Connect an agent"
      description="Agents that can use Baton as you, and how to add another."
      actions={count ? addButton : undefined}
    >
      <SettingsSection
        title={count === null ? "Connected agents" : `${count} connected`}
        description="Revoke one to sign it out right away."
        className="proto-enter"
      >
        {startEmpty ? (
          <div className="rounded-xl border border-border bg-card">
            <SettingsEmpty
              icon={<PlusIcon />}
              title="No agents connected yet"
              description="Pick your agent below. Setup takes a minute."
              action={addButton}
            />
          </div>
        ) : (
          <GrantsCard
            list={state.list}
            now={now}
            onRevoke={(grantId) => dispatch({ type: "ask-revoke", grantId })}
            onRetry={retry}
          />
        )}
        <AgentsNote />
      </SettingsSection>

      <section ref={addRef} className="proto-enter scroll-mt-6 space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Add an agent</h2>
          <p className="text-sm text-muted-foreground">
            Run setup once per agent. It signs in through your browser.
          </p>
        </div>
        <InstanceNotice kind={instance.kind} />
        <UrlLine url={instance.url} />
        <Accordion
          value={open}
          onValueChange={(value) =>
            setOpen(Array.isArray(value) ? value : [value])
          }
          className="rounded-xl border border-border bg-card px-4"
        >
          {CLIENTS.map((c) => (
            <AccordionItem key={c.id} value={c.id}>
              <AccordionTrigger className="items-center">
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
                  <span>{c.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {c.blurb}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionPanel>
                <div className="pb-1 text-foreground">
                  <SetupSteps
                    client={c.id}
                    url={instance.url}
                    kind={instance.kind}
                  />
                </div>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
        <TryIt />
      </section>

      <RevokeDialog
        state={state}
        onCancel={() => dispatch({ type: "cancel-revoke" })}
        onConfirm={confirmRevoke}
      />
    </SettingsPage>
  );
}
