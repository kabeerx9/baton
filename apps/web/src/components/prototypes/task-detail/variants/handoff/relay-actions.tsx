import { ArrowRightIcon, CheckIcon, XIcon } from "lucide-react";
import { Avatar } from "@/components/board/avatar";
import { Button } from "@/components/ui/button";
import type { PageProps } from "../../page-props";
import { nextActionControl } from "../../shared/use-next-action";
import { type Tone, TONE_CLASS } from "../../tone";
import { STAGE_LABEL } from "../../copy";

/** The one thing to do next, and a pending request when there is one. */
export function RelayActions({
  task,
  view,
  viewer,
  dispatch,
  tone,
}: PageProps & { tone: Tone }) {
  const control = nextActionControl({ view, viewer, dispatch });
  const { next, state } = view;
  const t = TONE_CLASS[tone];

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border/70 pt-5">
      {state.kind === "awaiting" && (
        <div
          className={`flex w-full flex-wrap items-center gap-3 rounded-2xl border ${t.border} ${t.soft} px-3.5 py-2.5 text-sm`}
        >
          <Avatar person={state.request.requester} size={24} />
          <span className="min-w-0 flex-1">
            <b className="font-semibold">
              {state.request.requester.name.split(" ")[0]}
            </b>{" "}
            asked to move this to{" "}
            <b className="font-semibold">{STAGE_LABEL[state.request.to]}</b>
            <span className="opacity-70"> · {state.request.expires}</span>
          </span>
          {next.kind === "answer" ? (
            <span className="flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  dispatch({ type: "answer", accept: true, viewer })
                }
              >
                <CheckIcon aria-hidden="true" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  dispatch({ type: "answer", accept: false, viewer })
                }
              >
                <XIcon aria-hidden="true" /> Reject
              </Button>
            </span>
          ) : state.request.requester.id === viewer.person.id ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => dispatch({ type: "withdraw", viewer })}
            >
              Withdraw
            </Button>
          ) : null}
        </div>
      )}

      {control.run ? (
        <Button onClick={control.run} size="lg" className="rounded-xl">
          {control.label}
          <ArrowRightIcon aria-hidden="true" />
        </Button>
      ) : next.kind === "wait" ? (
        <Button size="lg" variant="outline" disabled className="rounded-xl">
          {control.label}
        </Button>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {state.kind === "done"
          ? view.state.kind === "done" && view.state.released.length > 0
            ? "They were told they can continue."
            : "Nothing left to do."
          : state.kind === "blocked"
            ? "You can start now. Finishing waits."
            : state.kind === "unknown"
              ? "Baton does not know this status, so it offers no action."
              : task.assignee
                ? `${task.assignee.name.split(" ")[0]} owns it.`
                : "Nobody owns it yet."}
      </p>
    </div>
  );
}
