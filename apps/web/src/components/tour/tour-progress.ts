import { STEP_IDS, type StepId } from "./tour-steps";

/**
 * Where a running tour is, so a reload continues it. The server returns
 * the same demo on every start; only the step and the origin live here.
 */
export type TourProgress = {
  demoWorkspaceId: string;
  step: StepId;
  /** The real workspace to return to after the tour. */
  originWorkspaceId: string | null;
};

/** The runner's view of the store. The host binds it to one user. */
export type TourProgressStore = {
  read: () => unknown;
  write: (progress: TourProgress) => void;
  clear: () => void;
};

function isStepId(value: unknown): value is StepId {
  return (STEP_IDS as readonly unknown[]).includes(value);
}

/**
 * The saved progress for this demo, or null. Progress for another demo (an
 * earlier tour) or with an unknown step is ignored: the tour starts at step 1.
 */
export function parseTourProgress(
  raw: unknown,
  demoWorkspaceId: string,
): TourProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.demoWorkspaceId !== demoWorkspaceId) return null;
  if (!isStepId(value.step)) return null;
  const origin = value.originWorkspaceId;
  return {
    demoWorkspaceId,
    step: value.step,
    originWorkspaceId:
      typeof origin === "string" && origin !== demoWorkspaceId ? origin : null,
  };
}

const storageKey = (userId: string) => `baton:tour-progress:${userId}`;

/**
 * `localStorage`, so a reload or a restarted browser keeps the step. Storage
 * can be blocked; the tour then starts at step 1 in the same demo.
 */
export function localTourProgress(userId: string): TourProgressStore {
  const key = storageKey(userId);
  return {
    read: () => {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as unknown) : null;
      } catch {
        return null;
      }
    },
    write: (progress) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(progress));
      } catch {
        // Blocked storage only costs the step on the next reload.
      }
    },
    clear: () => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing to clear.
      }
    },
  };
}
