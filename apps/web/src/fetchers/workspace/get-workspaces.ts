import { authClient } from "@/lib/auth-client";

const getWorkspaces = async () => {
  // A read must not notify Better Auth's organization signals: the signal
  // bridge invalidates the workspace queries, which would refetch forever.
  const { data, error } = await authClient.organization.list({
    fetchOptions: { disableSignal: true },
  });

  if (error) {
    throw new Error(error.message || "Failed to fetch workspaces");
  }

  return data || [];
};

export default getWorkspaces;
