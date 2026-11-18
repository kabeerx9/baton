import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "@/components/ui/combobox";
import {
  matchesZone,
  selectedValue,
  zoneOptions,
} from "@/lib/time-zone/zone-options";

type Props = {
  value: string | null;
  onChange: (zone: string) => void;
  disabled?: boolean;
  /** Open the list at once, for a picker that replaces a summary. */
  defaultOpen?: boolean;
  autoFocus?: boolean;
  /** Escape closed the list: the owner can leave edit mode. */
  onEscape?: () => void;
  size?: "sm" | "default" | "lg";
  placeholder?: string;
};

/** Single-select, searchable list of every zone the browser knows (about 420 rows). */
export function TimeZonePicker({
  value,
  onChange,
  disabled,
  defaultOpen,
  autoFocus,
  onEscape,
  size = "default",
  placeholder,
}: Props) {
  const { t } = useTranslation("timeZone");
  const [query, setQuery] = useState("");
  const options = useMemo(() => zoneOptions(value, new Date()), [value]);
  const labels = useMemo(
    () => new Map(options.map((option) => [option.value, option.label])),
    [options],
  );
  const selected = selectedValue(options, value);

  // The combobox wrapper renders the items it is given and does not filter, so
  // filter here. On open the input holds the selected label: show the whole list.
  const showAll =
    query.trim() === "" ||
    (selected !== null && query === labels.get(selected));
  const items = options
    .filter((option) => showAll || matchesZone(option, query))
    .map((option) => option.value);

  return (
    <Combobox
      items={items}
      filter={null}
      value={selected}
      disabled={disabled}
      defaultOpen={defaultOpen}
      autoHighlight
      itemToStringLabel={(zone) => labels.get(zone) ?? zone}
      onInputValueChange={setQuery}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
      onOpenChange={(open, details) => {
        if (!open && details.reason === "escape-key") onEscape?.();
      }}
    >
      <ComboboxInput
        aria-label={t("picker.label")}
        autoFocus={autoFocus}
        onFocus={(event) => event.currentTarget.select()}
        placeholder={placeholder ?? t("picker.searchPlaceholder")}
        size={size}
      />
      <ComboboxPopup>
        <ComboboxEmpty>{t("picker.empty")}</ComboboxEmpty>
        <ComboboxList>
          {(zone: string) => (
            <ComboboxItem
              key={zone}
              value={zone}
              label={labels.get(zone) ?? zone}
            >
              {labels.get(zone) ?? zone}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
