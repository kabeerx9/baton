import { useMutation, useQueryClient } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { setTimeZone } from "@/fetchers/user/set-time-zone";
import type { CurrentUser } from "@/fetchers/user/time-zone-types";
import { currentUserKey } from "@/hooks/queries/user/use-current-user";
import { detectTimeZone } from "@/lib/time-zone/detect-time-zone";
import { writeDismissed } from "@/lib/time-zone/prompt-dismissal";

/**
 * Saves the zone. The save lifecycle is the mutation's own status; callers add
 * no booleans and show a failure themselves (a toast would cover the corner card).
 */
export function useSetTimeZone() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = currentUserKey(user?.id);

  return useMutation({
    mutationFn: setTimeZone,
    onSuccess: ({ timeZone }) => {
      queryClient.setQueryData<CurrentUser>(key, (previous) =>
        previous ? { ...previous, timeZone } : previous,
      );
      // An explicit pick answers the question for this device. Without this, a
      // pick that differs from the device zone would raise the mismatch prompt.
      const detected = detectTimeZone();
      if (user?.id && detected) writeDismissed(user.id, detected, "browser");
    },
  });
}
