const BASE_MS = 1000;
const CAP_MS = 30_000;
const FLOOR_MS = 500;

/**
 * Full jitter: uniform in [500 ms, window]. The window doubles per failure
 * from 1 s up to the 30 s cap. `failures` counts from 1.
 */
export function reconnectDelay(
  failures: number,
  random: () => number = Math.random,
) {
  const window = Math.min(
    CAP_MS,
    BASE_MS * 2 ** Math.min(Math.max(failures, 1) - 1, 5),
  );
  return Math.round(FLOOR_MS + random() * (window - FLOOR_MS));
}
