import { BotIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/get-initials";
import {
  acceptLabel,
  type Action,
  errorCopy,
  type MockRequest,
  type Phase,
  resolvedCopy,
  type Viewer,
} from "./model";

export function PersonAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <Avatar className={className ?? "size-5 bg-muted text-[10px]"}>
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function AgentBadge() {
  return (
    <Badge size="sm" variant="info">
      <BotIcon />
      agent
    </Badge>
  );
}

type ActionsProps = {
  request: MockRequest;
  viewer: Viewer;
  phase: Phase;
  onAction: (action: Action) => void;
  size?: "xs" | "sm" | "default";
};

function loadingFor(phase: Phase, action: Action): boolean {
  return phase.kind === "submitting" && phase.action === action;
}

/** The buttons for the viewer. Observers get none. */
export function RequestActions({
  request,
  viewer,
  phase,
  onAction,
  size = "sm",
}: ActionsProps) {
  const busy = phase.kind === "submitting" || phase.kind === "resolved";
  if (viewer === "observer") return null;
  if (viewer === "requester") {
    return (
      <Button
        disabled={busy && !loadingFor(phase, "cancel")}
        loading={loadingFor(phase, "cancel")}
        onClick={() => onAction("cancel")}
        size={size}
        variant="outline"
      >
        Cancel request
      </Button>
    );
  }
  return (
    <>
      <Button
        disabled={busy && !loadingFor(phase, "reject")}
        loading={loadingFor(phase, "reject")}
        onClick={() => onAction("reject")}
        size={size}
        variant="outline"
      >
        Reject
      </Button>
      <Button
        disabled={busy && !loadingFor(phase, "accept")}
        loading={loadingFor(phase, "accept")}
        onClick={() => onAction("accept")}
        size={size}
        variant={request.kind === "delete" ? "destructive" : "default"}
      >
        {acceptLabel(request.kind)}
      </Button>
    </>
  );
}

/** The error line and its way out. A decided request cannot be retried; it is dismissed. */
export function RequestError({
  phase,
  onDismiss,
}: {
  phase: Phase;
  onDismiss: () => void;
}) {
  if (phase.kind !== "error") return null;
  return (
    <p className="text-destructive-foreground text-xs" role="alert">
      {errorCopy(phase.reason, phase.action)}{" "}
      <button
        className="font-medium underline underline-offset-2"
        onClick={onDismiss}
        type="button"
      >
        {phase.reason === "decided" ? "Dismiss" : "Close"}
      </button>
    </p>
  );
}

export function ResolvedNote({
  phase,
  request,
}: {
  phase: Phase;
  request: MockRequest;
}) {
  if (phase.kind !== "resolved") return null;
  return (
    <p className="text-success-foreground text-sm" role="status">
      {resolvedCopy(phase.action, request.kind)}
    </p>
  );
}

export function observerCopy(request: MockRequest): string {
  return `${request.answerer} (assignee) or a workspace admin can answer.`;
}

export function requesterWaitCopy(request: MockRequest): string {
  return `Waiting for ${request.answerer} or a workspace admin.`;
}
