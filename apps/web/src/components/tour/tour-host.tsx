import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { finishTour } from "@/fetchers/tour/finish-tour";
import { startTour } from "@/fetchers/tour/start-tour";
import type { TourStatus } from "@/fetchers/tour/types";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import { TOUR_QUERY_KEY } from "@/hooks/queries/tour/use-tour-status";
import { WORKSPACES_QUERY_KEY } from "@/hooks/queries/workspace/workspace-query-keys";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import {
  forgetWorkspace,
  rememberWorkspace,
} from "@/lib/last-workspace/remembered-workspace";
import { toast } from "@/lib/toast";
import { dropDemoWorkspaceQueries } from "./drop-demo-workspace-queries";
import type { CloseReason, TourSession } from "./tour-machine";
import type { StepPage } from "./tour-steps";
import { localTourProgress } from "./tour-progress";
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
  const userId = useAuth().user?.id;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The workspace the user was in when the tour began.
  const [origin] = useState(
    () => WORKSPACE_PATH.exec(router.state.location.pathname)?.[1] ?? null,
  );

  const env = useMemo<TourEnv>(() => {
    const open = async (workspaceId: string, page: StepPage) => {
      // The agents settings page has no workspace in the URL: it shows this
      // tab's remembered one, so name the tour's workspace first.
      if (userId) rememberWorkspace(userId, workspaceId);
      if (page === "agents") {
        await navigate({ to: "/dashboard/settings/account/agents" });
        return;
      }
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
          if (userId) forgetWorkspace(userId, session.demoWorkspaceId);
          // The list never holds a demo workspace. Use the copy already on
          // screen when there is one: staying on a deleted workspace for a
          // network round trip is exactly what leaves 404s behind.
          let real =
            queryClient.getQueryData<Awaited<ReturnType<typeof getWorkspaces>>>(
              WORKSPACES_QUERY_KEY,
            );
          let target =
            real?.find((w) => w.id === session.originWorkspaceId) ?? real?.[0];
          // The remembered origin may be one (a reload mid-tour starts the
          // host inside the demo).
          if (!target) {
            real = await getWorkspaces().catch(() => []);
            target =
              real.find((w) => w.id === session.originWorkspaceId) ?? real[0];
          }
          if (target) await open(target.id, "board");
          else await navigate({ to: "/dashboard" });
          // Let the demo page unmount first: removing an active query makes
          // its observer ask again, and that request would 404.
          await new Promise((resolve) => setTimeout(resolve, 0));
          dropDemoWorkspaceQueries(queryClient, session.demoWorkspaceId);
          void queryClient.invalidateQueries({
            queryKey: WORKSPACES_QUERY_KEY,
          });
        })();
      },
      originWorkspaceId: origin,
      progress: userId ? localTourProgress(userId) : undefined,
      pathname,
      onError: (kind) =>
        toast.error(kind === "start" ? t("startError") : t("finishError")),
      onClosed,
    };
  }, [navigate, queryClient, userId, origin, pathname, onClosed, t]);

  return <TourRunner env={env} />;
}
