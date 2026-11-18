import { createFileRoute, redirect } from "@tanstack/react-router";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import { authClient } from "@/lib/auth-client";
import { handleUnauthorized, isUnauthorizedError } from "@/lib/http-error";
import type Workspace from "@/types/workspace";

export const Route = createFileRoute("/_layout/_authenticated/dashboard/")({
  beforeLoad: async () => {
    let workspaces: Workspace[];
    let session: Awaited<ReturnType<typeof authClient.getSession>>;
    try {
      [workspaces, session] = await Promise.all([
        getWorkspaces(),
        authClient.getSession(),
      ]);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleUnauthorized();
        return;
      }
      throw error;
    }

    const activeWorkspaceId = session?.data?.session?.activeOrganizationId;

    if (workspaces && workspaces.length > 0) {
      if (
        activeWorkspaceId &&
        workspaces.some((ws) => ws.id === activeWorkspaceId)
      ) {
        throw redirect({
          to: "/dashboard/workspace/$workspaceId",
          params: { workspaceId: activeWorkspaceId },
        });
      }

      const firstWorkspace = workspaces[0];

      authClient.organization.setActive({
        organizationId: firstWorkspace.id,
      });

      throw redirect({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: firstWorkspace.id },
      });
    }
    throw redirect({ to: "/onboarding" });
  },
});
