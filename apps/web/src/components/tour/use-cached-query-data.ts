import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

/**
 * Reads a query's cached data and re-renders when it changes, without adding
 * a query observer. A `useQuery` with no `queryFn` would log "No queryFn" on
 * every render and overwrite the owning page's options for the shared query.
 */
export function useCachedQueryData<T>(queryKey: QueryKey): T | undefined {
  const queryClient = useQueryClient();
  const hash = JSON.stringify(queryKey);
  const subscribe = useCallback(
    (onChange: () => void) => queryClient.getQueryCache().subscribe(onChange),
    [queryClient],
  );
  const read = useCallback(
    () => queryClient.getQueryData<T>(JSON.parse(hash) as QueryKey),
    [queryClient, hash],
  );
  return useSyncExternalStore(subscribe, read, read);
}
