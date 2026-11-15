import { cn } from "@/lib/cn";
import type { SetupCode } from "../setup";
import { CopyButton } from "./copy-button";

type CodeBlockProps = {
  code: SetupCode;
  what: string;
  className?: string;
};

// Long commands scroll sideways inside the block instead of wrapping, so what
// the person copies is what they see.
export function CodeBlock({ code, what, className }: CodeBlockProps) {
  const multiline = code.text.includes("\n");

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-muted/40",
        className,
      )}
    >
      {code.path ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-1.5">
          <span className="truncate font-mono text-xs text-muted-foreground">
            {code.path}
          </span>
          <CopyButton text={code.text} what={what} variant="ghost" />
        </div>
      ) : null}
      <div
        className={cn("flex gap-2", multiline ? "items-start" : "items-center")}
      >
        <pre className="min-w-0 flex-1 overflow-x-auto px-3 py-2.5 font-mono text-[13px] leading-relaxed">
          <code>{code.text}</code>
        </pre>
        {code.path ? null : (
          <div className="shrink-0 pe-1.5">
            <CopyButton text={code.text} what={what} />
          </div>
        )}
      </div>
    </div>
  );
}
