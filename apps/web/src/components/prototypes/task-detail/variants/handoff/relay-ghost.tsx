import { NODE_H } from "./relay-geometry";

/** An empty side still has a shape, so the relay never looks unfinished. */
export function RelayGhost({ text }: { text: string }) {
  return (
    <div
      style={{ height: NODE_H }}
      className="flex w-full items-center justify-center rounded-2xl border border-dashed border-border px-4 text-center text-xs text-muted-foreground"
    >
      {text}
    </div>
  );
}
