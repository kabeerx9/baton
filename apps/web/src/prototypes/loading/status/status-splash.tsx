import { cn } from "@/lib/cn";
import { LoadingScreen } from "../loading-screen";
import { SPLASH_REASSURE } from "../copy";
import type { VariantProps } from "../variant-types";
import { ProgressLine } from "./progress-line";
import { StepList } from "./step-list";

export function StatusSplash({ view, page, onRetry }: VariantProps) {
  const loading = view.kind === "loading" ? view : null;
  return (
    <LoadingScreen
      screen="splash"
      page={page}
      view={view}
      bones={false}
      onRetry={onRetry}
      overlay={
        <div className="relative h-full">
          <ProgressLine className="absolute inset-x-0 top-0" />
          <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
            <StepList step={loading?.step ?? 2} />
            <p
              aria-live="polite"
              className={cn(
                "min-h-4 text-xs text-muted-foreground transition-opacity duration-300 ease-out motion-reduce:transition-none",
                loading?.reassure ? "opacity-100" : "opacity-0",
              )}
            >
              {SPLASH_REASSURE}
            </p>
          </div>
        </div>
      }
    />
  );
}
