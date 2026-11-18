const storageKey = (userId: string) => `baton:last-workspace:${userId}`;

type Listener = () => void;
const listeners = new Set<Listener>();

function read(storage: () => Storage, key: string) {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // Storage can be blocked (private mode, quota). The pick still works.
  }
}

const session = () => window.sessionStorage;
const local = () => window.localStorage;

/**
 * The workspace this tab last opened. `sessionStorage` keeps two tabs apart;
 * `localStorage` seeds a new tab. A seeded value is copied into the tab at
 * once, so another tab's later choice does not move this one.
 */
export function readRememberedWorkspace(userId: string): string | null {
  const key = storageKey(userId);
  const own = read(session, key);
  if (own) return own;
  const shared = read(local, key);
  if (shared) write(session, key, shared);
  return shared;
}

export function rememberWorkspace(userId: string, workspaceId: string) {
  const key = storageKey(userId);
  if (read(session, key) === workspaceId && read(local, key) === workspaceId)
    return;
  write(session, key, workspaceId);
  write(local, key, workspaceId);
  notify();
}

/** Forget `workspaceId` only if it is still the remembered one. Idempotent. */
export function forgetWorkspace(userId: string, workspaceId: string) {
  const key = storageKey(userId);
  let changed = false;
  for (const storage of [session, local])
    if (read(storage, key) === workspaceId) {
      write(storage, key, null);
      changed = true;
    }
  if (changed) notify();
}

function notify() {
  for (const listener of listeners) listener();
}

/** In-tab changes only; no cross-tab `storage` listener by design. */
export function subscribeRememberedWorkspace(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
