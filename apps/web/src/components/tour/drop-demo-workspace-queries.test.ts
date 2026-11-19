import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";
import { dropDemoWorkspaceQueries } from "./drop-demo-workspace-queries";

const DEMO = "demo-workspace";

function clientWithCaches() {
  const client = new QueryClient();
  client.setQueryData(["workspace", DEMO], { id: DEMO, kind: "demo" });
  client.setQueryData(["task-board", DEMO], { tasks: [] });
  client.setQueryData(["assigned-tasks", DEMO, { countOnly: true }], []);
  client.setQueryData(["workspace-capabilities", DEMO, "member"], {});
  client.setQueryData(["workspace", "real"], { id: "real" });
  client.setQueryData(["task-board", "real"], { tasks: [] });
  return client;
}

describe("dropDemoWorkspaceQueries", () => {
  it("drops every cache entry keyed by the demo workspace", () => {
    const client = clientWithCaches();

    dropDemoWorkspaceQueries(client, DEMO);

    for (const key of [
      ["workspace", DEMO],
      ["task-board", DEMO],
      ["assigned-tasks", DEMO, { countOnly: true }],
      ["workspace-capabilities", DEMO, "member"],
    ]) {
      expect(client.getQueryData(key)).toBeUndefined();
    }
    // The real workspace's caches stay.
    expect(client.getQueryData(["workspace", "real"])).toEqual({ id: "real" });
    expect(client.getQueryData(["task-board", "real"])).toEqual({ tasks: [] });
    client.clear();
  });
});
