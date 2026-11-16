import { KeyHint } from "./key-hint";

const KEYS: { keys: string; label: string }[] = [
  { keys: "mod+k", label: "Command bar" },
  { keys: "s", label: "Advance status" },
  { keys: "p", label: "Cycle priority" },
  { keys: "a", label: "Take or release" },
  { keys: "c", label: "Write a comment" },
];

export function KeysPanel() {
  return (
    <ul className="space-y-1.5 text-sm">
      {KEYS.map((k) => (
        <li
          key={k.keys}
          className="flex items-center justify-between rounded-lg px-1 py-1"
        >
          <span>{k.label}</span>
          <KeyHint keys={k.keys} />
        </li>
      ))}
      <li className="pt-2 text-xs text-muted-foreground">
        Letters work when no field has focus. The picker keeps 1–3, ← → and R.
      </li>
    </ul>
  );
}
