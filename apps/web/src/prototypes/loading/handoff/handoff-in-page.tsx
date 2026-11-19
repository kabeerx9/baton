import { LoadingScreen } from "../loading-screen";
import { PAGE_REASSURE, pageLoadingLine } from "../copy";
import type { VariantProps } from "../variant-types";
import { HandoffMark } from "./handoff-mark";
import { StatusLines } from "./status-lines";

export function HandoffInPage({ view, page, onRetry }: VariantProps) {
  const loading = view.kind === "loading" ? view : null;
  return (
    <LoadingScreen
      screen="page"
      page={page}
      view={view}
      bones={false}
      onRetry={onRetry}
      overlay={
        <div className="flex h-full flex-col items-center justify-center gap-5 px-6 pb-10">
          <HandoffMark scale={1.5} />
          <StatusLines
            line={pageLoadingLine(page)}
            reassure={loading?.reassure ?? false}
            reassureLine={PAGE_REASSURE}
            stepKey={page}
          />
        </div>
      }
    />
  );
}
