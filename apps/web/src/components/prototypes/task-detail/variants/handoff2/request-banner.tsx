import { CheckIcon, XIcon } from "lucide-react";
import { Avatar } from "@/components/board/avatar";
import { Button } from "@/components/ui/button";
import { STAGE_LABEL } from "../../copy";
import type { PageProps } from "../../page-props";

/** A pending change request: who asked, what for, and the answer buttons. */
export function RequestBanner({ view, viewer, dispatch }: PageProps) {
  const { state, next } = view;
  if (state.kind !== "awaiting") return null;
  const r = state.request;
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-violet-500/25 bg-violet-500/[0.05] px-3.5 py-2.5 text-sm">
      <Avatar person={r.requester} size={24} />
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{r.requester.name.split(" ")[0]}</b> asked
        to move this to <b className="font-semibold">{STAGE_LABEL[r.to]}</b>
        <span className="text-muted-foreground"> · {r.expires}</span>
      </span>
      {next.kind === "answer" ? (
        <span className="flex gap-2">
          <Button
            size="sm"
            onClick={() => dispatch({ type: "answer", accept: true, viewer })}
          >
            <CheckIcon aria-hidden="true" /> Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => dispatch({ type: "answer", accept: false, viewer })}
          >
            <XIcon aria-hidden="true" /> Reject
          </Button>
        </span>
      ) : r.requester.id === viewer.person.id ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => dispatch({ type: "withdraw", viewer })}
        >
          Withdraw
        </Button>
      ) : null}
    </div>
  );
}
