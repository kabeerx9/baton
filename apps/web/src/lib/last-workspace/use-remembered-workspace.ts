import { useCallback, useSyncExternalStore } from "react";
import {
  readRememberedWorkspace,
  subscribeRememberedWorkspace,
} from "./remembered-workspace";

export function useRememberedWorkspace(userId: string | undefined) {
  const getSnapshot = useCallback(
    () => (userId ? readRememberedWorkspace(userId) : null),
    [userId],
  );
  return useSyncExternalStore(subscribeRememberedWorkspace, getSnapshot);
}
