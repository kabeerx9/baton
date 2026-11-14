export type ToggleGroupOrientation = "horizontal" | "vertical";

type NextEnabledIndexInput = {
  count: number;
  index: number;
  key: string;
  loop: boolean;
  orientation: ToggleGroupOrientation;
  rtl: boolean;
};

/**
 * The index an arrow, Home or End key moves to, counted in the group's enabled
 * toggles. `null` when the key is not one this group handles.
 *
 * UI SDK keeps a disabled toggle in a group's arrow-key order on purpose
 * (`focusableWhenDisabled` is forced on inside a group), so the wrapper moves
 * focus itself and this decides where. Movement mirrors the platform: the
 * arrow follows the reading direction, and without `loop` it stays at the end.
 */
export function nextEnabledIndex({
  count,
  index,
  key,
  loop,
  orientation,
  rtl,
}: NextEnabledIndexInput): number | null {
  if (count === 0 || index < 0 || index >= count) {
    return null;
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return count - 1;
  }

  const horizontal = orientation !== "vertical";
  const forwardKey =
    horizontal && !rtl ? "ArrowRight" : horizontal ? "ArrowLeft" : "ArrowDown";
  const backwardKey =
    horizontal && !rtl ? "ArrowLeft" : horizontal ? "ArrowRight" : "ArrowUp";
  if (key !== forwardKey && key !== backwardKey) {
    return null;
  }

  const next = index + (key === forwardKey ? 1 : -1);
  if (next < 0) {
    return loop ? count - 1 : 0;
  }
  if (next >= count) {
    return loop ? 0 : count - 1;
  }
  return next;
}
