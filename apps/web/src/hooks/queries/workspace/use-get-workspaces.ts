import { useQuery } from "@tanstack/react-query";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import { WORKSPACES_QUERY_KEY } from "./workspace-query-keys";

function useGetWorkspaces() {
  const {
    data: organizations,
    error,
    isPending,
  } = useQuery({ queryKey: WORKSPACES_QUERY_KEY, queryFn: getWorkspaces });

  return {
    data: organizations,
    error,
    isLoading: isPending,
    isError: !!error,
  };
}

export default useGetWorkspaces;
