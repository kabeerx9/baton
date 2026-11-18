import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettledSession } from "@/components/auth/use-settled-session";
import { JoinPageView } from "@/components/join/join-page-view";
import {
  deriveJoinScreen,
  type JoinInputs,
  shouldAutoJoin,
} from "@/components/join/join-screen-state";
import PageTitle from "@/components/page-title";
import { useJoinWorkspace } from "@/hooks/mutations/join-link/use-join-workspace";
import { useJoinLinkPreview } from "@/hooks/queries/join-link/use-join-link-preview";
import { authClient } from "@/lib/auth-client";
import { HttpError } from "@/lib/http-error";
import {
  clearJoinIntent,
  hasJoinIntent,
  rememberJoinIntent,
} from "@/lib/join-link";

export const Route = createFileRoute("/join/$token")({
  component: JoinRoute,
});

function JoinRoute() {
  const { t } = useTranslation();
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { session, isLoading: isSessionLoading } = useSettledSession();
  const preview = useJoinLinkPreview(token);
  const join = useJoinWorkspace();
  // Read once: a sign-up round trip left this token behind. Never from the URL.
  const [hadIntent] = useState(() => hasJoinIntent(token));
  const firedRef = useRef(false);

  const inputs: JoinInputs = {
    preview: preview.isPending
      ? { status: "pending" }
      : preview.isError
        ? { status: "error" }
        : { status: "success", data: preview.data },
    session: isSessionLoading
      ? "loading"
      : session?.user
        ? "signed_in"
        : "signed_out",
    join:
      join.isPending || join.isSuccess
        ? { status: "pending" }
        : join.isError
          ? {
              status: "error",
              code:
                join.error instanceof HttpError ? join.error.code : undefined,
            }
          : { status: "idle" },
    autoJoin: hadIntent && !join.isError,
  };
  const screen = deriveJoinScreen(inputs);

  const { mutate: joinMutate } = join;
  const joinNow = useCallback(() => {
    firedRef.current = true;
    clearJoinIntent();
    joinMutate(token, {
      onSuccess: ({ workspace }) =>
        navigate({
          to: "/dashboard/workspace/$workspaceId/board",
          params: { workspaceId: workspace.id },
        }),
    });
  }, [joinMutate, navigate, token]);

  const autoJoin = shouldAutoJoin(inputs);
  useEffect(() => {
    if (autoJoin && !firedRef.current) joinNow();
  }, [autoJoin, joinNow]);

  const goToAuth = (to: "/auth/sign-up" | "/auth/sign-in") => {
    rememberJoinIntent(token);
    void navigate({ to, search: { redirect: `/join/${token}` } });
  };

  const active =
    !preview.isPending && !preview.isError && preview.data.status === "active"
      ? preview.data
      : null;

  return (
    <>
      <PageTitle title={t("joinLink:page.pageTitle")} />
      <JoinPageView
        screen={screen}
        workspaceName={active?.workspace.name ?? null}
        sharedByName={active?.sharedBy?.name ?? null}
        expiresAt={active?.expiresAt ?? null}
        email={session?.user?.email ?? null}
        serverMessage={
          join.error instanceof HttpError ? join.error.message : null
        }
        onSignUp={() => goToAuth("/auth/sign-up")}
        onSignIn={() => goToAuth("/auth/sign-in")}
        onJoin={joinNow}
        onSwitchAccount={async () => {
          try {
            await authClient.signOut();
            void navigate({
              to: "/auth/sign-in",
              search: { redirect: `/join/${token}` },
            });
          } catch {
            // The page stays signed in; the button still works.
          }
        }}
      />
    </>
  );
}
