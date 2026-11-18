import { useQuery } from "@tanstack/react-query";
import getActiveOrganization from "@/fetchers/workspace/get-active-organization";
import { ACTIVE_ORGANIZATION_QUERY_KEY } from "./workspace-query-keys";

function useActiveOrganization() {
  return useQuery({
    queryKey: ACTIVE_ORGANIZATION_QUERY_KEY,
    queryFn: getActiveOrganization,
  });
}

export default useActiveOrganization;
