import { LoadingScreen } from "../loading-screen";
import type { VariantProps } from "../variant-types";

/** The shell stays real; the region shows the page's own shapes. */
export function DevelopInPage({ view, page, onRetry }: VariantProps) {
  return (
    <LoadingScreen
      screen="page"
      page={page}
      view={view}
      bones
      onRetry={onRetry}
    />
  );
}
