import { LoadingScreen } from "../loading-screen";
import { SPLASH_REASSURE, splashLine } from "../copy";
import type { VariantProps } from "../variant-types";
import { HandoffMark } from "./handoff-mark";
import { StatusLines } from "./status-lines";

export function HandoffSplash({ view, page, onRetry }: VariantProps) {
  const loading = view.kind === "loading" ? view : null;
  const step = loading?.step ?? 0;
  return (
    <LoadingScreen
      screen="splash"
      page={page}
      view={view}
      bones={false}
      onRetry={onRetry}
      overlay={
        <div className="ld-enter flex h-full flex-col items-center justify-center px-6">
          <img
            alt=""
            className="size-20 rounded-[22px] shadow-sm ring-1 ring-black/10 sm:size-24 sm:rounded-[26px] dark:ring-white/10"
            src="/favicon.svg"
          />
          <p className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
            Baton
          </p>
          <HandoffMark className="mt-10 sm:mt-12" scale={2} />
          <StatusLines
            className="mt-8"
            line={splashLine(step)}
            reassure={loading?.reassure ?? false}
            reassureLine={SPLASH_REASSURE}
            stepKey={String(step)}
          />
        </div>
      }
    />
  );
}
