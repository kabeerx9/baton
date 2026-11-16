import { useState } from "react";
import { Avatar } from "@/components/board/avatar";
import { StatusIcon } from "@/components/board/status-icon";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@/components/ui/command";
import { STAGE_LABEL } from "../../copy";
import type { PageProps } from "../../page-props";
import { ASSIGNABLE } from "../../shared/people-list";
import { PRIORITY_LABEL } from "../../tone";
import type { Priority, Status } from "../../types";
import { PriorityBars } from "../../shared/priority-bars";

const STATUSES: Status[] = ["todo", "doing", "review", "done"];
const PRIORITIES: Priority[] = ["none", "low", "medium", "high", "urgent"];

/** ⌘K: every change as a typed command. Closes after one is chosen. */
export function CommandBar({
  open,
  onOpenChange,
  viewer,
  dispatch,
}: Pick<PageProps, "viewer" | "dispatch"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const run = (fn: () => void) => () => {
    fn();
    setQuery("");
    onOpenChange(false);
  };
  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <CommandDialogPopup aria-label="Command bar">
        <Command query={query} onQueryChange={setQuery}>
          <CommandInput placeholder="Set status, priority, owner…" />
          <CommandPanel>
            <CommandEmpty>
              <p className="py-6 text-center text-sm text-muted-foreground">
                No command matches.
              </p>
            </CommandEmpty>
            <CommandList>
              <CommandGroup>
                <CommandGroupLabel>Status</CommandGroupLabel>
                {STATUSES.map((s) => (
                  <CommandItem
                    key={s}
                    value={`status ${STAGE_LABEL[s]}`}
                    onSelect={run(() =>
                      dispatch({ type: "set-status", to: s, viewer }),
                    )}
                    className="gap-2.5"
                  >
                    <StatusIcon status={s} size={13} />
                    Set status: {STAGE_LABEL[s]}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup>
                <CommandGroupLabel>Priority</CommandGroupLabel>
                {PRIORITIES.map((p) => (
                  <CommandItem
                    key={p}
                    value={`priority ${PRIORITY_LABEL[p]}`}
                    onSelect={run(() =>
                      dispatch({ type: "set-priority", priority: p }),
                    )}
                    className="gap-2.5"
                  >
                    <PriorityBars priority={p} />
                    Set priority: {PRIORITY_LABEL[p]}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup>
                <CommandGroupLabel>Owner</CommandGroupLabel>
                {ASSIGNABLE.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`assign ${p.name}`}
                    onSelect={run(() =>
                      dispatch({ type: "assign", person: p, viewer }),
                    )}
                    className="gap-2.5"
                  >
                    <Avatar person={p} size={16} />
                    Assign to {p.name}
                  </CommandItem>
                ))}
                <CommandItem
                  value="assign nobody unassign"
                  onSelect={run(() =>
                    dispatch({ type: "assign", person: null, viewer }),
                  )}
                >
                  Unassign
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </CommandPanel>
          <CommandFooter>
            <span>↑↓ to move</span>
            <span>↵ to run</span>
            <span>esc to close</span>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
