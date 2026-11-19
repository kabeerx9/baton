import type { Scenario } from "./scenarios";

/** Nothing shows before this: a load that ends sooner flashes nothing. */
export const SHOW_AFTER_MS = 300;
/** Once the loading UI shows, it stays at least this long. */
export const MIN_SHOWN_MS = 500;
/** The loading UI leaves and the content arrives over this span. */
export const HANDOFF_MS = 240;
/** One real awaited step (session, workspace, access) per span. */
export const STEP_MS = 500;
/** From the start of the load: show the reassuring line. */
export const REASSURE_AFTER_MS = 3000;

export type LoadStep = 0 | 1 | 2;

export type LoadView =
  | { kind: "quiet" }
  | { kind: "loading"; step: LoadStep; reassure: boolean }
  | { kind: "handoff"; wasShown: boolean }
  | { kind: "done" }
  | { kind: "failed" };

/** When the loading UI may leave: data time, held up by the minimum display. */
export function endsAtMs(scenario: Scenario): number {
  return scenario.resolveAtMs > SHOW_AFTER_MS
    ? Math.max(scenario.resolveAtMs, SHOW_AFTER_MS + MIN_SHOWN_MS)
    : scenario.resolveAtMs;
}

/** The one place the load lifecycle is decided. An unknown clock is quiet. */
export function deriveLoadView(
  scenario: Scenario,
  elapsedMs: number,
): LoadView {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return { kind: "quiet" };
  const end = endsAtMs(scenario);

  if (elapsedMs >= end) {
    if (scenario.outcome === "error") return { kind: "failed" };
    if (elapsedMs < end + HANDOFF_MS) {
      return { kind: "handoff", wasShown: end > SHOW_AFTER_MS };
    }
    return { kind: "done" };
  }
  if (elapsedMs < SHOW_AFTER_MS) return { kind: "quiet" };

  const step = Math.min(2, Math.floor((elapsedMs - SHOW_AFTER_MS) / STEP_MS));
  return {
    kind: "loading",
    step: step as LoadStep,
    reassure: elapsedMs >= REASSURE_AFTER_MS,
  };
}

/** Every moment `deriveLoadView` changes its answer, in order. */
export function changeTimesMs(scenario: Scenario): number[] {
  const end = endsAtMs(scenario);
  const candidates = [
    SHOW_AFTER_MS,
    SHOW_AFTER_MS + STEP_MS,
    SHOW_AFTER_MS + STEP_MS * 2,
    REASSURE_AFTER_MS,
    end,
    end + HANDOFF_MS,
  ];
  return [...new Set(candidates)]
    .filter((time) => time > 0)
    .filter(
      (time) =>
        JSON.stringify(deriveLoadView(scenario, time)) !==
        JSON.stringify(deriveLoadView(scenario, time - 1)),
    )
    .sort((a, b) => a - b);
}
