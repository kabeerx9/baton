import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { finishTour } from "@/fetchers/tour/finish-tour";
import { startTour } from "@/fetchers/tour/start-tour";
import type { TourStatus } from "@/fetchers/tour/types";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import { TOUR_QUERY_KEY } from "@/hooks/queries/tour/use-tour-status";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";
import type { CloseReason, TourSession } from "./tour-machine";
import { TourRunner, type TourEnv } from "./tour-runner";

const WORKSPACE_PATH = /^\/dashboard\/workspace\/([^/]+)/;

/** Wires the runner to the router, the auth client and the API. */
export default function TourHost({
  onClosed,
}: {
  onClosed: (reason: CloseReason) => void;
}) {
  const { t } = useTranslation("tour");
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  // The workspace the user was in when the tour began.
  const [origin] = useState(
    () => WORKSPACE_PATH.exec(router.state.location.pathname)?.[1] ?? null,
  );

  const env = useMemo<TourEnv>(() => {
    const open = async (workspaceId: string, page: "board" | "my-tasks") => {
      await authClient.organization.setActive({ organizationId: workspaceId });
      await navigate({
        to:
          page === "board"
            ? "/dashboard/workspace/$workspaceId/board"
            : "/dashboard/workspace/$workspaceId/my-tasks",
        params: { workspaceId },
      });
    };

    return {
      start: startTour,
      finish: async (outcome) => {
        const result = await finishTour(outcome);
        queryClient.setQueryData<TourStatus>(TOUR_QUERY_KEY, {
          completed: true,
          demoWorkspace: null,
        });
        return result;
      },
      goTo: (workspaceId, page) => void open(workspaceId, page),
      leaveDemo: (session: TourSession) => {
        void (async () => {
          const real =
            session.originWorkspaceId ??
            (await getWorkspaces().catch(() => []))[0]?.id;
          queryClient.removeQueries({
            predicate: (query) =>
              query.queryKey.includes(session.demoWorkspaceId),
          });
          await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
          if (real) await open(real, "board");
          else await navigate({ to: "/dashboard" });
        })();
      },
      originWorkspaceId: origin,
      onError: (kind) =>
        toast.error(kind === "start" ? t("startError") : t("finishError")),
      onClosed,
    };
  }, [navigate, queryClient, origin, onClosed, t]);

  return <TourRunner env={env} />;
}
