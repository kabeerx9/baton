import { LoadingScreen } from "../loading-screen";
import type { VariantProps } from "../variant-types";

/** No splash artwork: the workspace frame itself shows, as skeleton shapes. */
export function DevelopSplash({ view, page, onRetry }: VariantProps) {
  return (
    <LoadingScreen
      screen="splash"
      page={page}
      view={view}
      bones
      onRetry={onRetry}
    />
  );
}
