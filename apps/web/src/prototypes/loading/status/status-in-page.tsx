import { cn } from "@/lib/cn";
import { LoadingScreen } from "../loading-screen";
import { PAGE_REASSURE, pageLoadingLine } from "../copy";
import type { VariantProps } from "../variant-types";
import { ProgressLine } from "./progress-line";

/** A line on the panel's top edge and one caption row. The panel stays empty. */
export function StatusInPage({ view, page, onRetry }: VariantProps) {
  const loading = view.kind === "loading" ? view : null;
  return (
    <LoadingScreen
      screen="page"
      page={page}
      view={view}
      bones={false}
      onRetry={onRetry}
      overlay={
        <div className="relative h-full">
          <ProgressLine className="absolute inset-x-0 top-0" />
          <div className="flex min-h-10 flex-col gap-0.5 px-4 pt-4 sm:px-6">
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {pageLoadingLine(page)}
            </p>
            <p
              className={cn(
                "min-h-4 text-xs text-muted-foreground/80 transition-opacity duration-300 ease-out motion-reduce:transition-none",
                loading?.reassure ? "opacity-100" : "opacity-0",
              )}
            >
              {PAGE_REASSURE}
            </p>
          </div>
        </div>
      }
    />
  );
}
