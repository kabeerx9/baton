import { useTranslation } from "react-i18next";
import { CodeBlock } from "./code-block";
import type { InstanceKind } from "./instance";
import { KeysLink } from "./keys-link";
import { buildSetup } from "./setup";
import type { ClientId } from "./types";

type SetupStepsProps = {
  client: ClientId;
  url: string;
  kind: InstanceKind;
};

/** Numbered steps for one client. */
export function SetupSteps({ client, url, kind }: SetupStepsProps) {
  const { t } = useTranslation();
  const steps = buildSetup(client, url, kind);

  return (
    <ol className="space-y-5">
      {steps.map((step, index) => {
        // The scanner counts a key family only when the template ends in `${...}`.
        const copy = `${client}.${step.id}`;
        const titleKey = `${copy}.title`;
        const bodyKey = `${copy}.body`;
        const title = t(`settings:connectAgent.setup.${titleKey}`);
        return (
          <li key={step.id} className="flex gap-3.5">
            <span
              aria-hidden="true"
              className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-medium tabular-nums text-muted-foreground"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-medium">{title}</p>
              {step.hasBody ? (
                <p className="text-sm text-muted-foreground">
                  {t(`settings:connectAgent.setup.${bodyKey}`)}
                </p>
              ) : null}
              {step.keysLink ? (
                <p className="text-sm text-muted-foreground">
                  <KeysLink />
                </p>
              ) : null}
              {step.code ? (
                <CodeBlock code={step.code} what={title.toLowerCase()} />
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
