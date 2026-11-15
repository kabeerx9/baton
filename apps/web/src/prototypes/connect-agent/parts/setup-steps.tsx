import type { InstanceKind } from "../instance";
import { buildSetup } from "../setup";
import type { ClientId } from "../types";
import { CodeBlock } from "./code-block";
import { KeysLink } from "./keys-link";

type SetupStepsProps = {
  client: ClientId;
  url: string;
  kind: InstanceKind;
};

/** Numbered steps for one client. Used by variants that show the steps as a list. */
export function SetupSteps({ client, url, kind }: SetupStepsProps) {
  const steps = buildSetup(client, url, kind);

  return (
    <ol className="space-y-5">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-3.5">
          <span
            aria-hidden="true"
            className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-medium tabular-nums text-muted-foreground"
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium">{step.title}</p>
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
        </li>
      ))}
    </ol>
  );
}
