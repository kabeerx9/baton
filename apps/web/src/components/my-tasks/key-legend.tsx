import { useTranslation } from "react-i18next";
import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import type { ShortcutId } from "@/lib/shortcuts/catalog";

const KEYS: readonly ShortcutId[] = [
  "finishNextTask",
  "skipNextTask",
  "nextTask",
  "previousTask",
  "finishFocusedTask",
  "undoFinish",
];

/** The page's shortcuts, set quietly where the eye rests last. */
export function KeyLegend() {
  const { t } = useTranslation();
  return (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-muted-foreground text-xs">
      {KEYS.map((id) => (
        <div className="contents" key={id}>
          <dt>
            <ShortcutKeys id={id} tone="muted" />
          </dt>
          <dd>{t(`navigation:shortcuts.items.${id}`)}</dd>
        </div>
      ))}
    </dl>
  );
}
