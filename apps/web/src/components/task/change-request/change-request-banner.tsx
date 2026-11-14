import { ClockIcon, EyeIcon, HourglassIcon, XIcon } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { AgentBadge } from "@/components/common/agent-badge";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Decision } from "@/fetchers/task-change-request/decide-change-request";
import { formatRelativeTime } from "@/lib/format";
import { hoursLeft, type BannerRequest, type BannerState } from "./model";

type Props = {
  state: Exclude<BannerState, { kind: "hidden" }>;
  /** The requester's name, or null while it is unknown. */
  requesterName: string | null;
  statusLabel: (slug: string) => string;
  /** True when an unanswered request applies; false when it expires. */
  appliesOnTimeout: boolean;
  now: number;
  onDecide: (decision: Decision) => void;
  onDismiss: () => void;
};

function titleOf(
  t: TFunction,
  request: BannerRequest,
  mine: boolean,
  name: string,
  statusLabel: (slug: string) => string,
) {
  const to = statusLabel(request.targetStatus ?? "");
  if (request.kind === "delete")
    return mine
      ? t("tasks:changeRequest.mineDelete")
      : t("tasks:changeRequest.askDelete", { name });
  if (request.targetStatus === "archived")
    return mine
      ? t("tasks:changeRequest.mineArchive")
      : t("tasks:changeRequest.askArchive", { name });
  if (request.baseStatus) {
    const from = statusLabel(request.baseStatus);
    return mine
      ? t("tasks:changeRequest.mineStatusFrom", { from, to })
      : t("tasks:changeRequest.askStatusFrom", { name, from, to });
  }
  return mine
    ? t("tasks:changeRequest.mineStatus", { to })
    : t("tasks:changeRequest.askStatus", { name, to });
}

function closedCopy(state: string, t: TFunction): string {
  switch (state) {
    case "accepted":
      return t("tasks:changeRequest.closed.accepted");
    case "rejected":
      return t("tasks:changeRequest.closed.rejected");
    case "cancelled":
      return t("tasks:changeRequest.closed.cancelled");
    case "superseded":
      return t("tasks:changeRequest.closed.superseded");
    case "expired":
      return t("tasks:changeRequest.closed.expired");
    case "applied_on_timeout":
      return t("tasks:changeRequest.closed.applied_on_timeout");
    default:
      return t("tasks:changeRequest.closed.unknown");
  }
}

/** The pending request on a task: who asked, what, and what happens if nobody answers. */
export function ChangeRequestBanner({
  state,
  requesterName,
  statusLabel,
  appliesOnTimeout,
  now,
  onDecide,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  const request = state.request;
  const mine = state.kind === "open" && state.role === "cancel";
  const name = requesterName ?? t("tasks:changeRequest.someone");
  const title = request ? titleOf(t, request, mine, name, statusLabel) : "";

  if (state.kind === "closed") {
    return (
      <Alert
        aria-label={t("tasks:changeRequest.bannerLabel")}
        role="status"
        variant="success"
      >
        <ClockIcon />
        <AlertTitle>{closedCopy(state.state, t)}</AlertTitle>
        <AlertAction>
          <Button onClick={onDismiss} size="xs" variant="ghost">
            <XIcon />
            {t("tasks:changeRequest.dismiss")}
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  if (!request) return null;
  const { role, sending, error } = state;
  const busy = sending !== null;
  const hours = hoursLeft(request.expiresAt, now);
  const Icon =
    role === "observe"
      ? EyeIcon
      : role === "cancel"
        ? HourglassIcon
        : ClockIcon;
  const note =
    role === "observe"
      ? t("tasks:changeRequest.observe")
      : role === "cancel"
        ? t("tasks:changeRequest.waiting")
        : null;

  return (
    <Alert
      aria-label={t("tasks:changeRequest.bannerLabel")}
      data-role={role}
      role="status"
      variant={role === "answer" ? "warning" : "info"}
    >
      <Icon />
      <AlertTitle className="flex flex-wrap items-center gap-1.5">
        {title}
        {request.channel === "agent" && !mine && <AgentBadge />}
      </AlertTitle>
      <AlertDescription>
        <span>
          {request.createdAt
            ? `${t("tasks:changeRequest.asked", { when: formatRelativeTime(request.createdAt) })} `
            : ""}
          {appliesOnTimeout
            ? t("tasks:changeRequest.appliesIn", { count: hours })
            : t("tasks:changeRequest.expiresIn", { count: hours })}
          {note ? ` ${note}` : ""}
        </span>
        {error && (
          <span className="text-destructive-foreground text-xs" role="alert">
            {error === "decided"
              ? t("tasks:changeRequest.errorDecided")
              : t("tasks:changeRequest.errorFailed")}
          </span>
        )}
      </AlertDescription>
      {role !== "observe" && (
        <AlertAction>
          {role === "cancel" ? (
            <Button
              disabled={busy}
              loading={sending === "cancel"}
              onClick={() => onDecide("cancel")}
              size="sm"
              variant="outline"
            >
              {t("tasks:changeRequest.cancel")}
            </Button>
          ) : (
            <>
              <Button
                disabled={busy}
                loading={sending === "reject"}
                onClick={() => onDecide("reject")}
                size="sm"
                variant="outline"
              >
                {t("tasks:changeRequest.reject")}
              </Button>
              <Button
                disabled={busy}
                loading={sending === "accept"}
                onClick={() => onDecide("accept")}
                size="sm"
                variant={request.kind === "delete" ? "destructive" : "default"}
              >
                {request.kind === "delete"
                  ? t("tasks:changeRequest.acceptDelete")
                  : t("tasks:changeRequest.accept")}
              </Button>
            </>
          )}
        </AlertAction>
      )}
    </Alert>
  );
}
