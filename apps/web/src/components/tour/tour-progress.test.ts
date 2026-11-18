import { afterEach, describe, expect, it } from "vite-plus/test";
import { localTourProgress, parseTourProgress } from "./tour-progress";

describe("parseTourProgress", () => {
  it("returns the saved step and origin for the same demo", () => {
    expect(
      parseTourProgress(
        {
          demoWorkspaceId: "demo",
          step: "nav-board",
          originWorkspaceId: "real",
        },
        "demo",
      ),
    ).toEqual({
      demoWorkspaceId: "demo",
      step: "nav-board",
      originWorkspaceId: "real",
    });
  });

  it("ignores progress from another demo", () => {
    expect(
      parseTourProgress({ demoWorkspaceId: "old", step: "mcp" }, "demo"),
    ).toBeNull();
  });

  it("ignores an unknown step and junk values", () => {
    expect(
      parseTourProgress({ demoWorkspaceId: "demo", step: "gone" }, "demo"),
    ).toBeNull();
    expect(parseTourProgress("x", "demo")).toBeNull();
    expect(parseTourProgress(null, "demo")).toBeNull();
  });

  it("never returns the demo itself as the origin", () => {
    expect(
      parseTourProgress(
        { demoWorkspaceId: "demo", step: "welcome", originWorkspaceId: "demo" },
        "demo",
      )?.originWorkspaceId,
    ).toBeNull();
  });
});

describe("localTourProgress", () => {
  afterEach(() => window.localStorage.clear());

  it("round-trips per user and clears", () => {
    const store = localTourProgress("u1");
    store.write({
      demoWorkspaceId: "demo",
      step: "mcp",
      originWorkspaceId: null,
    });
    expect(localTourProgress("u2").read()).toBeNull();
    expect(store.read()).toEqual({
      demoWorkspaceId: "demo",
      step: "mcp",
      originWorkspaceId: null,
    });
    store.clear();
    expect(store.read()).toBeNull();
  });

  it("reads corrupt storage as nothing", () => {
    window.localStorage.setItem("baton:tour-progress:u1", "{not json");
    expect(localTourProgress("u1").read()).toBeNull();
  });
});
