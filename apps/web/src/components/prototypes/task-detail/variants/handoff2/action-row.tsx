import { ArrowRightIcon, ChevronDownIcon } from "lucide-react";
import { StatusIcon } from "@/components/board/status-icon";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { STAGE_LABEL } from "../../copy";
import type { PageProps } from "../../page-props";
import { nextActionControl } from "../../shared/use-next-action";
import { consentLine } from "./consent";
import { OPEN_MENU_KEY } from "./status-keys";
import { StatusMenu } from "./status-menu";

/** The next step as one big button, and the whole status menu beside it. */
export function ActionRow(
  props: PageProps & { menuOpen: boolean; onMenuOpen: (o: boolean) => void },
) {
  const { task, view, viewer, dispatch, menuOpen, onMenuOpen } = props;
  const control = nextActionControl({ view, viewer, dispatch });
  const note = consentLine(task, viewer);
  const status = view.status;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {control.run ? (
          <Button size="lg" onClick={control.run} className="rounded-xl">
            {control.label}
            <ArrowRightIcon aria-hidden="true" />
          </Button>
        ) : view.next.kind === "wait" ? (
          <Button size="lg" variant="outline" disabled className="rounded-xl">
            {control.label}
          </Button>
        ) : null}
        <StatusMenu
          task={task}
          view={view}
          viewer={viewer}
          dispatch={dispatch}
          open={menuOpen}
          onOpenChange={onMenuOpen}
          trigger={
            <Button
              size="lg"
              variant="outline"
              className="rounded-xl"
              aria-label="Change status"
            >
              {status && <StatusIcon status={status} size={15} />}
              <span className="text-muted-foreground">Status</span>
              {status ? STAGE_LABEL[status] : "Unknown"}
              <ChevronDownIcon aria-hidden="true" />
              <Kbd size="sm" tone="muted" aria-hidden="true">
                {OPEN_MENU_KEY.toUpperCase()}
              </Kbd>
            </Button>
          }
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {note ??
          (view.next.kind === "wait"
            ? "Finishing waits for the open tasks on the left."
            : "Or pick any status from the menu.")}
      </p>
    </div>
  );
}
