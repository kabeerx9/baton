import { useLocation } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { useCurrentUser } from "@/hooks/queries/user/use-current-user";
import { useTourStatus } from "@/hooks/queries/tour/use-tour-status";
import { detectTimeZone } from "@/lib/time-zone/detect-time-zone";
import {
  readDismissed,
  writeDismissed,
} from "@/lib/time-zone/prompt-dismissal";
import { deriveZonePrompt } from "./zone-prompt-state";

// The card, picker and zone list load only when a prompt is due.
const TimeZonePrompt = lazy(() => import("./time-zone-prompt"));

/** Mounted once in the authenticated layout, after the tour gate. Cheap while hidden. */
export function TimeZoneGate() {
  const { data: me } = useCurrentUser();
  const { data: tour } = useTourStatus();
  const pathname = useLocation({ select: (location) => location.pathname });
  const detected = useMemo(() => detectTimeZone(), []);
  const [dismissed, setDismissed] = useState<{
    userId: string;
    zone: string;
  } | null>(null);

  const dismissedFor = !me
    ? null
    : dismissed?.userId === me.id
      ? dismissed.zone
      : readDismissed(me.id);

  const prompt = deriveZonePrompt({
    stored: me?.timeZone,
    detected,
    dismissedFor,
    tourCompleted: tour?.completed,
    pathname,
    now: new Date(),
  });

  if (prompt.kind === "hidden" || !me) return null;
  return (
    <Suspense fallback={null}>
      <TimeZonePrompt
        prompt={prompt}
        onDismiss={(scope) => {
          writeDismissed(me.id, prompt.detected, scope);
          setDismissed({ userId: me.id, zone: prompt.detected });
        }}
      />
    </Suspense>
  );
}
