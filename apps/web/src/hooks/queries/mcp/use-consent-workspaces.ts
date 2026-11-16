import { useQuery } from "@tanstack/react-query";
import { listConsentWorkspaces } from "@/fetchers/mcp/list-consent-workspaces";

export function useConsentWorkspaces(enabled: boolean) {
  return useQuery({
    queryKey: ["mcp-consent-workspaces"],
    queryFn: listConsentWorkspaces,
    enabled,
  });
}
