import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConnectFlow } from "../connect-flow";

type ConfirmStepProps = {
  flow: ConnectFlow;
  clientName: string;
  canSimulate: boolean;
  onSimulate: () => void;
};

export function ConfirmStep({
  flow,
  clientName,
  canSimulate,
  onSimulate,
}: ConfirmStepProps) {
  if (flow.status === "connected") {
    return (
      <p
        role="status"
        className="flex items-center gap-2 text-sm text-success-foreground"
      >
        <CheckIcon aria-hidden="true" className="size-4" />
        {clientName} is connected. It is listed below.
      </p>
    );
  }

  const connecting = flow.status === "connecting";

  return (
    <div className="space-y-3">
      <p
        role="status"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <span aria-hidden="true" className="relative flex size-2">
          <span className="absolute inline-flex size-full rounded-full bg-primary/50 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        {connecting
          ? `${clientName} signed in. Updating the list…`
          : `Waiting for ${clientName} to sign in…`}
      </p>
      <p className="text-sm text-muted-foreground">
        Then ask your agent:{" "}
        <span className="text-foreground">“what tasks do I have?”</span>
      </p>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="border-dashed"
        disabled={!canSimulate || connecting}
        onClick={onSimulate}
      >
        Simulate sign-in (prototype)
      </Button>
    </div>
  );
}
