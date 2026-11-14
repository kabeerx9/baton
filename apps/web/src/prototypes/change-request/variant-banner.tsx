import { ClockIcon, EyeIcon, HourglassIcon } from "lucide-react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { askedAgo, describeAsk, fallbackCopy } from "./model";
import type { PanelProps } from "./panel-types";
import {
  AgentBadge,
  observerCopy,
  RequestActions,
  RequestError,
  requesterWaitCopy,
  ResolvedNote,
} from "./parts";

/** Banner: an always-open block above the description. Answering is one click away. */
export function VariantBanner(props: PanelProps) {
  const { request, viewer, phase, now, onAction, onDismiss } = props;

  if (phase.kind === "resolved") {
    return (
      <Alert className="proto-rise" variant="success">
        <ClockIcon />
        <AlertTitle>
          <ResolvedNote phase={phase} request={request} />
        </AlertTitle>
      </Alert>
    );
  }

  const Icon =
    viewer === "observer"
      ? EyeIcon
      : viewer === "requester"
        ? HourglassIcon
        : ClockIcon;
  const note =
    viewer === "observer"
      ? observerCopy(request)
      : viewer === "requester"
        ? requesterWaitCopy(request)
        : null;

  return (
    <Alert
      className="proto-rise"
      variant={viewer === "answerer" ? "warning" : "info"}
    >
      <Icon />
      <AlertTitle className="flex flex-wrap items-center gap-1.5">
        {describeAsk(request, viewer)}
        {request.channel === "agent" && viewer !== "requester" && (
          <AgentBadge />
        )}
      </AlertTitle>
      <AlertDescription>
        <span>
          Asked {askedAgo(request, now)}. {fallbackCopy(request, now)}
          {note ? ` ${note}` : ""}
        </span>
        <RequestError onDismiss={onDismiss} phase={phase} />
      </AlertDescription>
      {viewer !== "observer" && (
        <AlertAction>
          <RequestActions
            onAction={onAction}
            phase={phase}
            request={request}
            viewer={viewer}
          />
        </AlertAction>
      )}
    </Alert>
  );
}
