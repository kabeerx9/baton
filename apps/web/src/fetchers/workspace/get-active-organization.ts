import { authClient } from "@/lib/auth-client";

/** The session's active organization, or null when none is active. */
const getActiveOrganization = async () => {
  const { data, error } = await authClient.organization.getFullOrganization({
    fetchOptions: { disableSignal: true },
  });

  if (error) {
    throw new Error(error.message || "Failed to fetch active workspace");
  }

  return data ?? null;
};

export default getActiveOrganization;
