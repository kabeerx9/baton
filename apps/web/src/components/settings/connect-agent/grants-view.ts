import type { McpGrant, McpGrantsPage } from "@/fetchers/mcp/list-grants";

export const STALE_AFTER_DAYS = 60;
const DAY = 24 * 60 * 60 * 1000;

// What the page shows for the list. Derived from the query, never stored.
export type GrantsView =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      grants: McpGrant[];
      hasMore: boolean;
      loadingMore: boolean;
      loadMoreFailed: boolean;
    };

type GrantsQueryShape = {
  status: string;
  data?: { pages: McpGrantsPage[] };
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
};

/** Data wins over status, so a failed refetch keeps the rows. An unknown status is loading. */
export function deriveGrantsView(query: GrantsQueryShape): GrantsView {
  if (query.data) {
    const seen = new Set<string>();
    const grants = query.data.pages
      .flatMap((page) => page.grants)
      .filter((g) => !seen.has(g.id) && seen.add(g.id));
    return {
      status: "ready",
      grants,
      hasMore: query.hasNextPage,
      loadingMore: query.isFetchingNextPage,
      loadMoreFailed: query.isFetchNextPageError,
    };
  }
  return query.status === "error" ? { status: "error" } : { status: "loading" };
}

/** A grant not used for 60 days is stale. Unparseable dates are not flagged. */
export function isStale(lastUsedAt: string, now: number): boolean {
  const used = new Date(lastUsedAt).getTime();
  return Number.isFinite(used) && now - used >= STALE_AFTER_DAYS * DAY;
}
