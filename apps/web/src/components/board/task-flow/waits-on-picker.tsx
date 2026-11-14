import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@/components/ui/command";
import { StatusIcon } from "../status-icon";
import type { WaitsOnCandidate } from "./waits-on-candidates";

/** A searchable list of tasks. Picking one calls `onPick`. */
export function WaitsOnPicker({
  open,
  onOpenChange,
  candidates,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: WaitsOnCandidate[];
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <CommandDialogPopup aria-label={t("workspace:board.waitsOn.pickerLabel")}>
        <Command
          items={candidates}
          itemToStringValue={(item: unknown) => {
            const { key, title } = item as WaitsOnCandidate;
            return `${key} ${title}`;
          }}
        >
          <CommandInput
            placeholder={t("workspace:board.waitsOn.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <CommandPanel>
            <CommandEmpty>
              <p className="py-6 text-center text-muted-foreground text-sm">
                {t("workspace:board.waitsOn.noTasks")}
              </p>
            </CommandEmpty>
            <CommandList>
              {(item: WaitsOnCandidate) => (
                <CommandItem
                  key={item.id}
                  value={`${item.key} ${item.title}`}
                  onClick={() => onPick(item.id)}
                  className="flex items-center gap-3 py-2"
                >
                  <StatusIcon status={item.status} size={13} />
                  <span className="shrink-0 font-mono text-muted-foreground text-xs">
                    {item.key}
                  </span>
                  <span className="flex-1 truncate text-sm">{item.title}</span>
                </CommandItem>
              )}
            </CommandList>
          </CommandPanel>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
