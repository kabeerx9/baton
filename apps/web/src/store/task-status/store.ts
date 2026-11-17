import { create } from "zustand";
import { IDLE, transition } from "./transition";
import type { Entry, Event, Step } from "./types";

type State = {
  /** One entry per task. A task with no entry is idle. */
  entries: Record<string, Entry>;
  /** Names for the request modal. Set while a request waits or flies; display only. */
  titles: Record<string, string>;
};

export const useTaskStatusStore = create<State>(() => ({
  entries: {},
  titles: {},
}));

export function entryOf(taskId: string): Entry {
  return useTaskStatusStore.getState().entries[taskId] ?? IDLE;
}

/**
 * Applies one event to a task's entry, atomically, and says what happened.
 * The only writer of the store: every control and the writer go through it.
 */
export function dispatchStatus(
  taskId: string,
  event: Event,
  title?: string,
): { prev: Entry; step: Step } {
  const { entries, titles } = useTaskStatusStore.getState();
  const prev = entries[taskId] ?? IDLE;
  const step = transition(prev, event);
  if (step.entry === prev) return { prev, step };

  const nextEntries = { ...entries };
  if (step.entry.kind === "idle") delete nextEntries[taskId];
  else nextEntries[taskId] = step.entry;

  const nextTitles = { ...titles };
  const asking =
    step.entry.kind === "confirming" || step.entry.kind === "asking";
  if (asking && title) nextTitles[taskId] = title;
  else if (!asking) delete nextTitles[taskId];

  useTaskStatusStore.setState({ entries: nextEntries, titles: nextTitles });
  return { prev, step };
}

export function resetTaskStatusStore() {
  useTaskStatusStore.setState({ entries: {}, titles: {} });
}
