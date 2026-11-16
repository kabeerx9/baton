import { Kbd } from "@/components/ui/kbd";
import { useShortcutHint } from "@/components/ui/shortcuts";

/** The keys for a shortcut, shown for the user's platform. */
export function KeyHint({ keys }: { keys: string }) {
  const hint = useShortcutHint(keys);
  return (
    <Kbd aria-hidden="true" tone="muted">
      {hint.text}
    </Kbd>
  );
}
