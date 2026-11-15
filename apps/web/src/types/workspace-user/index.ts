import type { authClient } from "@/lib/auth-client";

export type WorkspaceUser = NonNullable<
  Awaited<ReturnType<typeof authClient.organization.listMembers>>["data"]
>[number];

// Workspace invitation types
export type WorkspaceUserInvitation = NonNullable<
  Awaited<ReturnType<typeof authClient.organization.listInvitations>>["data"]
>[number];

export default WorkspaceUser;
