import { describe, expect, it } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { deriveActiveWorkspace } from "./derive-active-workspace";

const ws = { id: "a" };
const settledList = { isPending: false, error: null };
const noRead = { data: undefined, isPending: true, error: null };
const remembered = { kind: "remembered", id: "a" } as const;
const route = { kind: "route", id: "a" } as const;

describe("deriveActiveWorkspace", () => {
  it("waits for the user before trusting a remembered or first pick", () => {
    expect(
      deriveActiveWorkspace({
        userKnown: false,
        pick: { kind: "none" },
        list: settledList,
        read: noRead,
      }),
    ).toEqual({ status: "loading" });
  });

  it("is loading, not none, while the list loads", () => {
    expect(
      deriveActiveWorkspace({
        userKnown: true,
        pick: { kind: "none" },
        list: { isPending: true, error: null },
        read: noRead,
      }),
    ).toEqual({ status: "loading" });
  });

  it("is none once the list is empty", () => {
    expect(
      deriveActiveWorkspace({
        userKnown: true,
        pick: { kind: "none" },
        list: settledList,
        read: noRead,
      }),
    ).toEqual({ status: "none" });
  });

  it("is ready only with the picked workspace's own read", () => {
    expect(
      deriveActiveWorkspace({
        userKnown: true,
        pick: remembered,
        list: settledList,
        read: noRead,
      }),
    ).toEqual({ status: "loading" });
    expect(
      deriveActiveWorkspace({
        userKnown: true,
        pick: route,
        list: settledList,
        read: { data: ws, isPending: false, error: null },
      }),
    ).toEqual({ status: "ready", workspace: ws });
  });

  it("tells archived apart from a refusal, though both are 403", () => {
    const archived = new HttpError(403, "archived", {
      code: "WORKSPACE_ARCHIVED",
    });
    expect(
      deriveActiveWorkspace({
        userKnown: true,
        pick: route,
        list: settledList,
        read: { data: undefined, isPending: false, error: archived },
      }),
    ).toEqual({ status: "archived", pick: route });
    for (const status of [403, 404])
      expect(
        deriveActiveWorkspace({
          userKnown: true,
          pick: remembered,
          list: settledList,
          read: {
            data: undefined,
            isPending: false,
            error: new HttpError(status, "no"),
          },
        }),
      ).toEqual({ status: "unavailable", pick: remembered });
  });

  it("never shows stale data after a refusal", () => {
    expect(
      deriveActiveWorkspace({
        userKnown: true,
        pick: route,
        list: settledList,
        read: { data: ws, isPending: false, error: new HttpError(404, "gone") },
      }),
    ).toEqual({ status: "unavailable", pick: route });
  });

  it("keeps cached data through a transient failure", () => {
    expect(
      deriveActiveWorkspace({
        userKnown: true,
        pick: route,
        list: settledList,
        read: { data: ws, isPending: false, error: new HttpError(500, "x") },
      }),
    ).toEqual({ status: "ready", workspace: ws });
  });
});
