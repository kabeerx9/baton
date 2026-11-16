import { useInfiniteQuery } from "@tanstack/react-query";
import { listMcpGrants } from "@/fetchers/mcp/list-grants";

export const MCP_GRANTS_KEY = ["mcp-grants"] as const;

/** The caller's connected agents, one page at a time. Follow `nextCursor` for more. */
export function useMcpGrants() {
  return useInfiniteQuery({
    queryKey: MCP_GRANTS_KEY,
    queryFn: ({ pageParam }) => listMcpGrants(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
