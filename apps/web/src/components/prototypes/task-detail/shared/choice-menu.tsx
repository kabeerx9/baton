import type { ReactNode } from "react";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/components/ui/menu";

export type Choice = { value: string; label: ReactNode };

/**
 * A menu of radio choices. UI SDK's menu gives arrow-key roving focus,
 * typeahead, and focus return to the trigger.
 */
export function ChoiceMenu({
  value,
  choices,
  onChange,
  trigger,
  align = "start",
}: {
  value: string;
  choices: Choice[];
  onChange: (value: string) => void;
  /** One button element. It receives the menu's trigger props. */
  trigger: React.ReactElement;
  align?: "start" | "center" | "end";
}) {
  return (
    <Menu>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuPopup align={align} className="min-w-44">
        <MenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(String(v))}
        >
          {choices.map((c) => (
            <MenuRadioItem key={c.value} value={c.value}>
              {c.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}
