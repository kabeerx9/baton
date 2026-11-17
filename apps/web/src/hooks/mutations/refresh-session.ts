import { authClient } from "@/lib/auth-client";

type SessionAtom = { refetch?: () => Promise<unknown> };

/**
 * Reload the signed-in user after the server changed it outside a Better Auth
 * client call. The change is already committed, so a failed reload is not an
 * error for the caller; the next session fetch catches up.
 */
export async function refreshSession() {
  const session = authClient.$store.atoms.session?.get() as
    | SessionAtom
    | undefined;
  try {
    await session?.refetch?.();
  } catch {
    return;
  }
}

export default refreshSession;
