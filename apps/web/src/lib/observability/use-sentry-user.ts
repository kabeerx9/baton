import * as Sentry from "@sentry/react";
import { useEffect } from "react";

/** Identifies the signed-in user to Sentry by id only: no email or name. */
export function useSentryUser(userId: string | undefined) {
  useEffect(() => {
    Sentry.setUser(userId ? { id: userId } : null);
  }, [userId]);
}
