import type { QueryClient } from "@tanstack/react-query";
import { ADMIN_USERS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-users";
import { getSettledSession } from "@/lib/cached-session";
import invalidateUserProfileQueries from "../invalidate-user-profile-queries";
import refreshSession from "../refresh-session";

/** Pictures show across boards and lists; the session too when it is your own. */
export async function refreshAfterAdminAvatarChange(
  queryClient: QueryClient,
  userId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY }),
    invalidateUserProfileQueries(queryClient),
    getSettledSession()?.user.id === userId ? refreshSession() : null,
  ]);
}

export default refreshAfterAdminAvatarChange;
