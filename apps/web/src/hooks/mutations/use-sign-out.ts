import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { replayAuthEntrance } from "@/components/auth/auth-entrance";
import { replayShellEntrance } from "@/components/common/shell-entered";
import { descriptionSaveQueue } from "@/lib/description-save-queue";
import { i18n } from "@/lib/i18n";
import { authClient } from "@/lib/auth-client";
import { signOutState } from "@/lib/sign-out-state";

function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  return useMutation({
    mutationFn: async () => {
      const resume = descriptionSaveQueue.pause(session?.user.id ?? "");
      let returnTo: string | null = null;
      try {
        if (!(await descriptionSaveQueue.drain(session?.user.id ?? "")))
          throw new Error(i18n.t("tasks:detail.editor.saveFailed"));
        signOutState.isRedirecting = true;
        replayAuthEntrance();
        replayShellEntrance();
        returnTo =
          window.location.pathname +
          window.location.search +
          window.location.hash;
        await navigate({ to: "/auth/sign-in", replace: true });

        const result = await authClient.signOut();
        if (result.error) {
          throw new Error(result.error.message);
        }
        descriptionSaveQueue.clear();
        // Drop the signed-out user's data before leaving the app, but keep the
        // instance config and status that the auth pages reuse.
        queryClient.removeQueries({
          predicate: ({ queryKey }) =>
            queryKey[0] !== "config" && queryKey[0] !== "instance-status",
        });
        queryClient.getMutationCache().clear();
        signOutState.isRedirecting = false;
        return result.data;
      } catch (error) {
        signOutState.isRedirecting = false;
        if (returnTo) void navigate({ href: returnTo, replace: true });
        throw error;
      } finally {
        resume();
      }
    },
  });
}

export default useSignOut;
