import { describe, expect, it } from "vite-plus/test";
import type { McpGrant } from "@/fetchers/mcp/list-grants";
import { deriveGrantsView, isStale } from "./grants-view";

const grant = (id: string): McpGrant => ({
  id,
  clientName: id,
  workspace: null,
  createdAt: "2026-01-01T00:00:00Z",
  lastUsedAt: "2026-01-02T00:00:00Z",
});
const base = {
  hasNextPage: false,
  isFetchingNextPage: false,
  isFetchNextPageError: false,
};

describe("deriveGrantsView", () => {
  it("is loading before data and for an unknown status", () => {
    expect(deriveGrantsView({ ...base, status: "pending" })).toEqual({
      status: "loading",
    });
    expect(deriveGrantsView({ ...base, status: "mystery" }).status).toBe(
      "loading",
    );
  });

  it("is an error only when there is no data", () => {
    expect(deriveGrantsView({ ...base, status: "error" }).status).toBe("error");
    const kept = deriveGrantsView({
      ...base,
      status: "error",
      data: { pages: [{ grants: [grant("a")], nextCursor: null }] },
    });
    expect(kept.status === "ready" && kept.grants).toHaveLength(1);
  });

  it("joins pages and drops a grant seen twice", () => {
    const view = deriveGrantsView({
      ...base,
      status: "success",
      hasNextPage: true,
      data: {
        pages: [
          { grants: [grant("a"), grant("b")], nextCursor: "c" },
          { grants: [grant("b"), grant("c")], nextCursor: null },
        ],
      },
    });
    expect(view.status === "ready" && view.grants.map((g) => g.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(view.status === "ready" && view.hasMore).toBe(true);
  });
});

describe("isStale", () => {
  const now = Date.parse("2026-11-16T00:00:00Z");
  it("flags 60 days or more", () => {
    expect(isStale("2026-09-17T00:00:00Z", now)).toBe(true);
    expect(isStale("2026-09-18T00:00:00Z", now)).toBe(false);
    expect(isStale("garbage", now)).toBe(false);
  });
});
