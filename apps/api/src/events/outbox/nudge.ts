// A leaf module so the event bus can wake the relay without importing it.
const listeners = new Set<() => void>();

export function onOutboxNudge(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Wakes this process's relay loops. Without a running relay it does nothing. */
export function nudgeOutbox(): void {
  for (const listener of listeners) listener();
}
