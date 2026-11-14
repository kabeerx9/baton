import {
  ChevronDownIcon,
  ClockIcon,
  TriangleAlertIcon,
  CheckIcon,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import {
  askedAgo,
  describeAsk,
  describeChange,
  fallbackCopy,
  requesterName,
} from "./model";
import type { PanelProps } from "./panel-types";
import {
  observerCopy,
  PersonAvatar,
  RequestActions,
  RequestError,
  requesterWaitCopy,
  ResolvedNote,
} from "./parts";

/** Chip: a small marker in the header that opens the full request. Costs one click to answer. */
export function VariantChip(props: PanelProps) {
  const { request, viewer, phase, now, onAction, onDismiss } = props;
  const submitting = phase.kind === "submitting";
  const failed = phase.kind === "error";
  const resolved = phase.kind === "resolved";

  const tone = resolved
    ? "border-success/32 bg-success/8 text-success-foreground"
    : failed
      ? "border-destructive/32 bg-destructive/8 text-destructive-foreground"
      : viewer === "answerer"
        ? "border-warning/32 bg-warning/8 text-warning-foreground"
        : "border-input bg-muted text-foreground";

  const label = resolved
    ? "Answered"
    : viewer === "requester"
      ? `You asked · ${describeChange(request)}`
      : `${requesterName(request)} · ${describeChange(request)}`;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "proto-rise inline-flex h-6 max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-2 text-xs outline-none transition-[background-color,scale] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
          tone,
        )}
      >
        {submitting ? (
          <Spinner className="size-3" />
        ) : failed ? (
          <TriangleAlertIcon className="size-3" />
        ) : resolved ? (
          <CheckIcon className="size-3" />
        ) : (
          <ClockIcon className="size-3" />
        )}
        <span className="truncate">{label}</span>
        {viewer === "answerer" && !resolved && !failed && !submitting && (
          <span className="font-medium">Review</span>
        )}
        <ChevronDownIcon className="size-3 opacity-60" />
      </PopoverTrigger>
      <PopoverPopup align="start" className="w-[22rem]">
        <div className="flex flex-col gap-3">
          {resolved ? (
            <ResolvedNote phase={phase} request={request} />
          ) : (
            <>
              <div className="flex items-start gap-2">
                <PersonAvatar
                  className="mt-0.5 size-6 bg-muted text-[10px]"
                  name={request.requestedBy}
                />
                <div className="flex flex-col gap-0.5">
                  <p className="font-medium text-sm">
                    {describeAsk(request, viewer)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Asked {askedAgo(request, now)}
                  </p>
                </div>
              </div>
              <p className="rounded-md bg-muted px-2.5 py-2 text-muted-foreground text-xs">
                {fallbackCopy(request, now)}
              </p>
              {viewer === "observer" && (
                <p className="text-muted-foreground text-xs">
                  {observerCopy(request)}
                </p>
              )}
              {viewer === "requester" && (
                <p className="text-muted-foreground text-xs">
                  {requesterWaitCopy(request)}
                </p>
              )}
              <RequestError onDismiss={onDismiss} phase={phase} />
              {viewer !== "observer" && (
                <div className="flex justify-end gap-2">
                  <RequestActions
                    onAction={onAction}
                    phase={phase}
                    request={request}
                    size="sm"
                    viewer={viewer}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
