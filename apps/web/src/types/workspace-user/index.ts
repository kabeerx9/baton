import type { authClient } from "@/lib/auth-client";

export type WorkspaceUser = NonNullable<
  Awaited<ReturnType<typeof authClient.organization.listMembers>>["data"]
>[number];

export default WorkspaceUser;
