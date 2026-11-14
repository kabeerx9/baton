import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Channel, RequestKind, ServerReply, Viewer } from "./model";
import type { Scenario } from "./use-simulation";

function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; text: string }[];
  onChange: (value: T) => void;
}): ReactNode {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <div
        className="flex gap-0.5 rounded-lg bg-muted p-0.5"
        role="group"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            aria-pressed={option.value === value}
            className={cn(
              "cursor-pointer rounded-md px-2 py-1 text-xs transition-colors duration-150",
              option.value === value
                ? "bg-background font-medium shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Harness chrome: flips the viewer, the request and the server's reply. Not part of any variant. */
export function ScenarioControls({
  scenario,
  onChange,
  onReset,
}: {
  scenario: Scenario;
  onChange: (patch: Partial<Scenario>) => void;
  onReset: () => void;
}) {
  return (
    <aside
      aria-label="Prototype scenario"
      className="fixed top-4 right-4 z-40 flex w-60 flex-col gap-3 rounded-xl border bg-popover p-3 shadow-lg/5"
    >
      <Seg<Viewer>
        label="Viewer"
        onChange={(viewer) => onChange({ viewer })}
        options={[
          { text: "Can answer", value: "answerer" },
          { text: "Requester", value: "requester" },
          { text: "Other", value: "observer" },
        ]}
        value={scenario.viewer}
      />
      <Seg<RequestKind>
        label="Change"
        onChange={(kind) => onChange({ kind })}
        options={[
          { text: "Status", value: "status" },
          { text: "Archive", value: "archive" },
          { text: "Delete", value: "delete" },
        ]}
        value={scenario.kind}
      />
      <Seg<Channel>
        label="Requester used"
        onChange={(channel) => onChange({ channel })}
        options={[
          { text: "Web", value: "web" },
          { text: "Agent", value: "agent" },
        ]}
        value={scenario.channel}
      />
      <Seg<ServerReply>
        label="Server replies"
        onChange={(reply) => onChange({ reply })}
        options={[
          { text: "OK", value: "ok" },
          { text: "409", value: "decided" },
          { text: "Fail", value: "failed" },
          { text: "Hang", value: "hang" },
        ]}
        value={scenario.reply}
      />
      <button
        className="cursor-pointer rounded-md border px-2 py-1 text-xs hover:bg-accent/50"
        onClick={onReset}
        type="button"
      >
        Reset request
      </button>
    </aside>
  );
}
