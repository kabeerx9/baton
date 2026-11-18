import { windowId } from "@baton/libs";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { getApiUrl } from "@/fetchers/get-api-url";
import { membersUpdatedKeys } from "@/hooks/queries/join-link/keys";
import {
  WORKSPACES_QUERY_KEY,
  workspaceQueryKey,
} from "@/hooks/queries/workspace/workspace-query-keys";
import {
  evictInaccessibleWorkspaceCache,
  evictWorkspaceCache,
} from "@/lib/evict-workspace-cache";
import { authClient } from "@/lib/auth-client";
import { readRememberedWorkspace } from "@/lib/last-workspace/remembered-workspace";
import { leaveGoneWorkspace } from "@/lib/leave-gone-workspace";
import { reconcileProjectAccess } from "@/lib/reconcile-project-access";
import {
  classifyUserClose,
  type UserEndReason,
} from "@/lib/realtime-connection/classify-user-close";
import type { ConnectionState } from "@/lib/realtime-connection/connection-state";
import { createConnection } from "@/lib/realtime-connection/create-connection";

export function getUserWsUrl() {
  const base = getApiUrl("ws");
  const wsBase = base.replace(/^http/, "ws");
  return `${wsBase}/user?windowId=${encodeURIComponent(windowId)}`;
}

/**
 * Maintains a user-scoped WebSocket connection for receiving user-targeted
 * real-time events (e.g. NOTIFICATION_CREATED). Invalidates TanStack Query
 * caches as needed, so no polling is required.
 */
export function useUserWebSocket() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const { data: session } = authClient.useSession();
  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    // Dispose ends the connection, so a previous session cannot act late.
    const isEnded = () => connection.state().status === "ended";

    // Membership or a role may have changed: the list, each workspace read
    // (it carries the caller's role) and the capability maps.
    function refreshWorkspaceState() {
      for (const queryKey of [
        WORKSPACES_QUERY_KEY,
        ["workspace"],
        ["workspace-capabilities"],
      ])
        void queryClient.invalidateQueries({ queryKey });
    }

    // Settings pages name no workspace in the URL; they show this tab's
    // remembered one.
    function currentWorkspaceId(path: string) {
      return /^\/dashboard\/settings\/(workspace|projects)(\/|$)/.test(path)
        ? (readRememberedWorkspace(userId) ?? undefined)
        : path.match(/^\/dashboard\/workspace\/([^/]+)/)?.[1];
    }

    // The cookie may hold another tab's newer session, so never sign it out.
    function leaveSession() {
      queryClient.clear();
      authClient.$store.notify("$sessionSignal");
      void navigate({ to: "/auth/sign-in" });
    }

    function onState(state: ConnectionState<UserEndReason>) {
      if (
        state.status === "ended" &&
        (state.reason === "user-access-revoked" ||
          state.reason === "session-ended")
      )
        leaveSession();
    }

    function handleMessage(data: string) {
      try {
        const message = JSON.parse(data) as {
          type?: string;
          workspaceId?: string;
          workspaceIds?: string[] | null;
          reason?: string;
        };
        if (message.type === "USER_ACCESS_REVOKED") {
          connection.end("user-access-revoked");
          return;
        }
        if (
          message.type === "WORKSPACE_ACCESS_SYNC" &&
          Array.isArray(message.workspaceIds) &&
          message.workspaceIds.every((id) => typeof id === "string")
        ) {
          evictInaccessibleWorkspaceCache(queryClient, message.workspaceIds);
          for (const workspaceId of message.workspaceIds)
            reconcileProjectAccess(queryClient, workspaceId, () => !isEnded());
          refreshWorkspaceState();
          const current = currentWorkspaceId(pathnameRef.current);
          if (current && !message.workspaceIds.includes(current))
            void leaveGoneWorkspace(current, {
              queryClient,
              navigate: (destination) => navigate(destination),
              userId,
            });
        }
        if (
          message.type === "WORKSPACE_ACCESS_REVOKED" &&
          message.workspaceId
        ) {
          evictWorkspaceCache(queryClient, message.workspaceId);
          refreshWorkspaceState();
          // An archived board stays and shows the archived screen.
          void queryClient.invalidateQueries({
            queryKey: workspaceQueryKey(message.workspaceId),
          });
          const path = pathnameRef.current;
          const current = currentWorkspaceId(path);
          if (
            current === message.workspaceId &&
            (message.reason !== "archived" ||
              !path.startsWith("/dashboard/workspace/"))
          )
            void leaveGoneWorkspace(message.workspaceId, {
              queryClient,
              navigate: (destination) => navigate(destination),
              userId,
            });
        }
        if (message.type === "WORKSPACE_RESTORED" && message.workspaceId) {
          void queryClient.invalidateQueries({
            queryKey: ["admin", "workspaces"],
          });
          void queryClient.invalidateQueries({
            queryKey: workspaceQueryKey(message.workspaceId),
          });
          refreshWorkspaceState();
        }
        if (message.type === "PROJECT_ACCESS_CHANGED" && message.workspaceId) {
          const { workspaceId } = message;
          for (const queryKey of [
            ["projects", workspaceId],
            ["assigned-tasks", workspaceId],
            ["search", { workspaceId }],
            ["workspace-activity", workspaceId],
            ["labels", workspaceId],
            ["workspace-users", workspaceId, "project-access"],
            ["notifications"],
          ])
            void queryClient.invalidateQueries({ queryKey });
          reconcileProjectAccess(queryClient, workspaceId, () => !isEnded());
        }
        if (
          message.type === "WORKSPACE_MEMBERS_UPDATED" &&
          message.workspaceId
        ) {
          for (const queryKey of membersUpdatedKeys(message.workspaceId))
            void queryClient.invalidateQueries({ queryKey });
        }
        if (message.type === "NOTIFICATION_CREATED") {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      } catch {
        // Ignore malformed messages
      }
    }

    const connection = createConnection<UserEndReason>({
      url: getUserWsUrl(),
      classifyClose: classifyUserClose,
      // The cookie may hold another tab's newer session: same means reconnect.
      checkSession: async (signal) => {
        const { data, error } = await authClient.getSession({
          fetchOptions: { signal },
        });
        if (error && error.status !== 401) return "unknown";
        return data?.user.id === userId ? "same" : "gone";
      },
      // The server sends WORKSPACE_ACCESS_SYNC on every open. These keys
      // miss events from while the socket was down. "projects" is left out:
      // a refetch could land before reconcileProjectAccess reads its cache.
      onOpen: ({ reconnect }) => {
        if (!reconnect) return;
        for (const queryKey of [
          ["notifications"],
          ["workspaces"],
          ["admin", "workspaces"],
        ])
          void queryClient.invalidateQueries({ queryKey });
      },
      onMessage: handleMessage,
      onState,
    });

    return () => connection.dispose();
  }, [session?.user?.id, session?.session?.id, queryClient, navigate]);
}
