import { StatusIcon } from "@/components/board/status-icon";
import { Kbd } from "@/components/ui/kbd";
import { STAGE_LABEL } from "../../copy";
import type { PageProps } from "../../page-props";
import { ChoiceMenu } from "../../shared/choice-menu";
import type { Status } from "../../types";
import { consentLine } from "./consent";
import { STATUS_KEY } from "./status-keys";

const STATUSES: Status[] = ["todo", "doing", "review", "done"];

/** The status menu. Each row shows its key. It says when a choice sends a request. */
export function StatusMenu({
  task,
  view,
  viewer,
  dispatch,
  open,
  onOpenChange,
  trigger,
  align = "start",
}: Pick<PageProps, "task" | "view" | "viewer" | "dispatch"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement;
  align?: "start" | "center" | "end";
}) {
  const request = !viewer.involved;
  return (
    <ChoiceMenu
      align={align}
      open={open}
      onOpenChange={onOpenChange}
      value={view.status ?? ""}
      choices={STATUSES.map((s) => ({
        value: s,
        label: (
          <span className="flex w-full items-center gap-2">
            <StatusIcon status={s} size={14} />
            <span className="flex-1">
              {request ? `Request: ${STAGE_LABEL[s]}` : STAGE_LABEL[s]}
            </span>
            <Kbd size="sm" tone="muted" aria-hidden="true">
              {STATUS_KEY[s].toUpperCase()}
            </Kbd>
          </span>
        ),
      }))}
      onChange={(v) =>
        dispatch({ type: "set-status", to: v as Status, viewer })
      }
      footer={consentLine(task, viewer)}
      trigger={trigger}
    />
  );
}
