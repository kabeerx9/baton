import { useEffect, useRef, useState } from "react";
import { getCurrentUser } from "@/fetchers/user/get-current-user";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import { useCurrentUser } from "@/hooks/queries/user/use-current-user";
import { hasInstanceAdminRole } from "@/lib/instance-admin";

// "stale" is a refresh that failed: the cached role is all there is.
type RoleStatus = "pending" | "fresh" | "stale";

export type WorkspaceCreationAccess = {
  /** A confirmed non-admin under a confirmed `DISABLE_WORKSPACE_CREATION`. */
  isCreationRestricted: boolean;
  /** Both answers have settled, one way or another. */
  isDecided: boolean;
  /** Decided, and not restricted. */
  canCreateWorkspace: boolean;
};

/**
 * Whether to offer this user a workspace to create. The API is the authority —
 * it enforces `DISABLE_WORKSPACE_CREATION` through Better Auth's
 * `allowUserToCreateOrganization` — so this only decides what is worth
 * offering, and every screen that offers it has to agree.
 */
export default function useWorkspaceCreationAccess(): WorkspaceCreationAccess {
  const { data: currentUser } = useCurrentUser();
  const { data: config, isPending: configPending } = useGetConfig();

  // The cached account can be up to five minutes stale: the first-user
  // bootstrap promotes to admin after sign-up. Elsewhere a stale role only
  // hides a button; here it decides whether the first administrator of an
  // instance is told to go and ask someone for an invitation. Re-read it once,
  // and know whether the answer arrived.
  //
  // Guarded by a ref so React's development double-mount does not send it
  // twice.
  const refreshStarted = useRef(false);
  const [roleStatus, setRoleStatus] = useState<RoleStatus>("pending");
  const [refreshedRole, setRefreshedRole] = useState<string | null>(null);

  useEffect(() => {
    if (refreshStarted.current) return;
    refreshStarted.current = true;

    void (async () => {
      try {
        const me = await getCurrentUser();
        setRefreshedRole(me.role);
        setRoleStatus("fresh");
      } catch {
        // Swallowed rather than left to surface as an unhandled rejection.
        setRoleStatus("stale");
      }
    })();
  }, []);

  // The re-read answer when there is one, the cached role when there is not.
  const isInstanceAdmin = hasInstanceAdminRole(
    roleStatus === "fresh" ? refreshedRole : currentUser?.role,
  );

  // Only a confirmed non-admin under a confirmed restriction loses anything.
  // Every other combination — a role that could not be re-read, a config
  // request that failed — falls back to offering the form and leaves the API
  // with the final say, which it has either way. Guessing the other way would
  // strand a user on a screen with nothing on it.
  const isCreationRestricted =
    roleStatus === "fresh" &&
    !isInstanceAdmin &&
    !configPending &&
    config?.disableWorkspaceCreation === true;

  // An instance admin waits for the role refresh and nothing else: the setting
  // cannot restrict them, so the config's value cannot change their outcome
  // and waiting for it would only delay a form they are always entitled to.
  // Everyone else waits for both, rather than being shown a screen or a
  // control that the next render takes away.
  const isDecided =
    roleStatus !== "pending" && (isInstanceAdmin || !configPending);

  return {
    isCreationRestricted,
    isDecided,
    canCreateWorkspace: isDecided && !isCreationRestricted,
  };
}
