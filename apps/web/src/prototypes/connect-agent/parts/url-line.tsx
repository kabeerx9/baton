import { CopyButton } from "./copy-button";

/** The MCP URL for this instance, with a copy button. */
export function UrlLine({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 py-1.5 ps-3 pe-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">MCP URL</span>
      <code className="min-w-0 flex-1 select-all truncate font-mono text-[13px]">
        {url}
      </code>
      <CopyButton text={url} what="MCP URL" />
    </div>
  );
}
