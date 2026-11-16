// Contract types for /api/tour. The route is not in the typed `@baton/libs`
// client yet; when the backend lands, derive these from `AppType` instead.

export const DEMO_TASK_KEYS = [
  "design-review",
  "api-endpoint",
  "write-tests",
  "ship-release",
  "mcp-hello",
] as const;

export type DemoTaskKey = (typeof DEMO_TASK_KEYS)[number];

export type TourStatus = {
  completed: boolean;
  demoWorkspace: { id: string; slug: string } | null;
};

export type TourStart = {
  demoWorkspace: { id: string; slug: string; projectId: string };
  tasks: { key: DemoTaskKey; id: string; number?: number }[];
};

export type TourOutcome = "finished" | "skipped";
