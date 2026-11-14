import { ArrowRightIcon, MessageSquareDashedIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { askedAgo, describeChange, fallbackCopy, requesterName } from "./model";
import type { PanelProps } from "./panel-types";
import {
  AgentBadge,
  observerCopy,
  PersonAvatar,
  RequestActions,
  RequestError,
  requesterWaitCopy,
  ResolvedNote,
} from "./parts";

/** A faint pointer next to the Status property that jumps to the entry. */
export function ThreadStatusHint({
  request,
  phase,
}: Pick<PanelProps, "request" | "phase">) {
  if (phase.kind === "resolved") return null;
  return (
    <Button
      className="proto-rise h-5 rounded-full border-dashed px-2 text-muted-foreground text-xs"
      onClick={() =>
        document
          .getElementById("change-request-entry")
          ?.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      size="xs"
      variant="outline"
    >
      <ArrowRightIcon className="size-3" />
      {describeChange(request)} pending
    </Button>
  );
}

/** Thread: the request is an event in the activity list, answered where the history lives. */
export function VariantThread(props: PanelProps) {
  const { request, viewer, phase, now, onAction, onDismiss } = props;
  return (
    <li
      className="proto-rise relative flex flex-col gap-2.5 rounded-xl border border-dashed bg-muted/40 p-3"
      id="change-request-entry"
    >
      <span className="-start-[29px] absolute top-3.5 flex size-4 items-center justify-center rounded-full bg-background text-warning-foreground ring-1 ring-warning/40">
        <MessageSquareDashedIcon className="size-2.5" />
      </span>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <PersonAvatar name={request.requestedBy} />
        <span className="font-medium">
          {viewer === "requester" ? "You" : request.requestedBy}
        </span>
        {request.channel === "agent" && viewer !== "requester" && (
          <AgentBadge />
        )}
        <span className="text-muted-foreground">
          requested {describeChange(request)}
        </span>
        <span className="ms-auto text-muted-foreground text-xs">
          {askedAgo(request, now)}
        </span>
      </div>
      {phase.kind === "resolved" ? (
        <ResolvedNote phase={phase} request={request} />
      ) : (
        <>
          <p className="text-muted-foreground text-xs">
            {fallbackCopy(request, now)}{" "}
            {viewer === "observer" && observerCopy(request)}
            {viewer === "requester" && requesterWaitCopy(request)}
            {viewer === "answerer" &&
              `${requesterName(request)} cannot change this task without your answer.`}
          </p>
          <RequestError onDismiss={onDismiss} phase={phase} />
          {viewer !== "observer" && (
            <div className="flex gap-2">
              <RequestActions
                onAction={onAction}
                phase={phase}
                request={request}
                size="xs"
                viewer={viewer}
              />
            </div>
          )}
        </>
      )}
    </li>
  );
}
