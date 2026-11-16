import type { PageProps } from "../../page-props";
import { PulseRail } from "./pulse-rail";
import { PulseTimeline } from "./pulse-timeline";
import { RightNow } from "./right-now";
import { StatusBand } from "./status-band";

/**
 * Pulse. The axis is "what happened": a loud status band, one card for the
 * next move, then a live timeline that is never empty.
 */
export function PulseVariant(props: PageProps) {
  return (
    <main>
      <StatusBand {...props} />
      <div className="mx-auto w-full max-w-5xl px-4 pb-10 sm:px-6">
        <RightNow {...props} />
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <PulseTimeline {...props} />
          <PulseRail {...props} />
        </div>
      </div>
    </main>
  );
}
