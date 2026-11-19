import * as Sentry from "@sentry/react";
import {
  createContext,
  type PropsWithChildren,
  useEffect,
  useRef,
} from "react";
import { markBootSplashShown } from "@/lib/boot-splash";
import { authClient } from "@/lib/auth-client";
import { descriptionSaveQueue } from "@/lib/description-save-queue";
import type { User } from "@/types/user";
import { useDelayedPending } from "../../common/pending/use-delayed-pending";
import { SplashScreen } from "../../common/splash/splash-screen";

const { useSession } = authClient;

export const AuthContext = createContext<{
  user: User | null | undefined;
  isLoading: boolean;
  refetchUser: () => Promise<void>;
}>({
  user: undefined,
  isLoading: true,
  refetchUser: async () => {},
});

function AuthProvider({ children }: PropsWithChildren) {
  const { data, isPending, refetch, error } = useSession();
  // Only hold the tree back during the *first* session fetch. Better
  // Auth re-fetches the session on window focus; returning nothing while
  // those background fetches are pending would unmount the whole route tree
  // on every alt-tab.
  const previousOwner = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (isPending || error) return;
    const owner = data?.user.id ?? null;
    if (previousOwner.current !== owner) descriptionSaveQueue.clear();
    previousOwner.current = owner;
  }, [data?.user.id, isPending, error]);
  const hasLoadedOnce = useRef(false);
  if (!isPending) {
    hasLoadedOnce.current = true;
  }

  // Tag transient Safari "Load failed" errors during the session fetch so
  // instrument.ts's beforeSend can drop them. Better Auth's useSession
  // uses nanostores rather than TanStack Query, so the query client's
  // network-error cooldown doesn't reach this path. Real auth failures
  // (e.g. 401) still surface to Sentry through Better Auth.
  useEffect(() => {
    if (error instanceof Error && error.message.includes("Load failed")) {
      Sentry.captureException(error, { tags: { area: "auth.session" } });
    }
  }, [error]);

  const booting = isPending && !hasLoadedOnce.current;
  // Blank for 300ms, then the splash, held for at least 500ms once it shows.
  const splashUp = useDelayedPending(booting);
  if (splashUp) markBootSplashShown();
  if (booting || splashUp) {
    return splashUp ? (
      <SplashScreen step="session" />
    ) : (
      <div className="h-svh w-full bg-background" />
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user: (data?.user as User | null | undefined) ?? null,
        isLoading: isPending,
        refetchUser: async () => {
          await refetch({ query: { disableCookieCache: true } });
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
