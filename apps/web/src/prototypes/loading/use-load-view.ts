import { useEffect, useState } from "react";
import { changeTimesMs, deriveLoadView, type LoadView } from "./load-view";
import type { Scenario } from "./scenarios";

type Clock = { run: string; elapsedMs: number };

/**
 * Drives one load for the harness. `runKey` changes on every replay or switch.
 * With `freezeAtMs` the clock never runs, so a screenshot shows one moment.
 * Timers belong to the effect, so StrictMode and replays clear them.
 */
export function useLoadView(
  scenario: Scenario,
  runKey: string,
  freezeAtMs?: number,
): LoadView {
  const run = `${scenario.id}:${runKey}`;
  const [clock, setClock] = useState<Clock>({ run, elapsedMs: 0 });

  useEffect(() => {
    if (freezeAtMs !== undefined) return;
    setClock({ run, elapsedMs: 0 });
    const ids = changeTimesMs(scenario).map((time) =>
      window.setTimeout(() => setClock({ run, elapsedMs: time }), time),
    );
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [scenario, run, freezeAtMs]);

  if (freezeAtMs !== undefined) return deriveLoadView(scenario, freezeAtMs);
  // A clock from the previous run reads as the start of this one.
  return deriveLoadView(scenario, clock.run === run ? clock.elapsedMs : 0);
}
