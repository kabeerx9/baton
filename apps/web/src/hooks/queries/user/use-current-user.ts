import { useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { getCurrentUser } from "@/fetchers/user/get-current-user";

export const currentUserKey = (userId: string | undefined) =>
  ["user", "me", userId] as const;

/** The signed-in user's account data, including the saved time zone. */
export function useCurrentUser() {
  const { user } = useAuth();
  return useQuery({
    queryKey: currentUserKey(user?.id),
    queryFn: getCurrentUser,
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });
}
