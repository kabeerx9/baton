import type { QueryClient } from "@tanstack/react-query";
import {
  ACTIVE_ORGANIZATION_QUERY_KEY,
  WORKSPACES_QUERY_KEY,
} from "@/hooks/queries/workspace/workspace-query-keys";
import { authClient } from "@/lib/auth-client";

let bridged = false;

/**
 * Better Auth announces organization changes (create, delete, setActive, and
 * our own `$store.notify` calls) on its signals. Turn each one into a TanStack
 * invalidation, so one place owns workspace state and every caller of
 * `setActive` or `$store.notify` refreshes it without extra code.
 */
export function bridgeOrganizationSignals(queryClient: QueryClient) {
  if (bridged) return;
  bridged = true;
  const refresh = (keys: readonly (readonly string[])[]) => () => {
    for (const queryKey of keys)
      void queryClient.invalidateQueries({ queryKey });
  };
  authClient.$store.listen("$listOrg", refresh([WORKSPACES_QUERY_KEY]));
  authClient.$store.listen(
    "$activeOrgSignal",
    refresh([WORKSPACES_QUERY_KEY, ACTIVE_ORGANIZATION_QUERY_KEY]),
  );
  authClient.$store.listen(
    "$sessionSignal",
    refresh([ACTIVE_ORGANIZATION_QUERY_KEY]),
  );
}
