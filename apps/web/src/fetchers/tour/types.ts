import type { InferResponseType } from "hono/client";
import type { client } from "@baton/libs";

// Derived from the API, so the contract cannot drift from the server.
export type TourStatus = InferResponseType<typeof client.tour.$get, 200>;
export type TourStart = InferResponseType<typeof client.tour.start.$post, 200>;
export type DemoTaskKey = TourStart["tasks"][number]["key"];
export type TourOutcome = "finished" | "skipped";

export const DEMO_TASK_KEYS = [
  "design-review",
  "api-endpoint",
  "write-tests",
  "ship-release",
  "mcp-hello",
] as const satisfies readonly DemoTaskKey[];
