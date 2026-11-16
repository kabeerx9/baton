import { ArrowRightIcon, CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STAGE_LABEL } from "../../copy";
import type { PageProps } from "../../page-props";
import { nextActionControl } from "../../shared/use-next-action";
import { toneOf, TONE_CLASS } from "../../tone";
import { KeyHint } from "./key-hint";

/** One line, in the color of the state: what is true, and the key to act. */
export function NextStrip(props: PageProps) {
  const { view, viewer, dispatch } = props;
  const tone = TONE_CLASS[toneOf(view.state)];
  const control = nextActionControl({ view, viewer, dispatch });
  const { state, next } = view;
  const text =
    state.kind === "blocked"
      ? `Blocked by ${state.on.map((t) => t.key).join(", ")}. Starting is allowed; finishing waits.`
      : state.kind === "awaiting"
        ? `${state.request.requester.name.split(" ")[0]} asks for ${STAGE_LABEL[state.request.to]} · ${state.request.expires}`
        : state.kind === "done"
          ? state.released.length > 0
            ? `Done. ${state.released.map((t) => t.key).join(", ")} can continue.`
            : "Done. Nothing waits on it."
          : state.kind === "unknown"
            ? "Unknown status. Actions are off."
            : view.waitingOnMe.length > 0
              ? `Clear to go. ${view.waitingOnMe.map((t) => t.key).join(", ")} wait${view.waitingOnMe.length === 1 ? "s" : ""} on it.`
              : "Clear to go. Nothing waits on it.";
  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${tone.border} bg-gradient-to-r ${tone.wash} px-3.5 py-2.5`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`size-2 shrink-0 rounded-full ${tone.dot} ${state.kind === "blocked" ? "proto-breathe" : ""}`}
          aria-hidden="true"
        />
        <p className="min-w-0 flex-1 text-sm">{text}</p>
        {next.kind === "answer" ? (
          <span className="flex gap-1.5">
            <Button
              size="xs"
              onClick={() => dispatch({ type: "answer", accept: true, viewer })}
            >
              <CheckIcon aria-hidden="true" /> Accept
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                dispatch({ type: "answer", accept: false, viewer })
              }
            >
              <XIcon aria-hidden="true" /> Reject
            </Button>
          </span>
        ) : control.run ? (
          <Button size="xs" onClick={control.run}>
            {control.label}
            <ArrowRightIcon aria-hidden="true" />
            <KeyHint keys="s" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
