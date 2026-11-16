export const DEMO_TASK_KEYS = [
  "design-review",
  "api-endpoint",
  "write-tests",
  "ship-release",
  "mcp-hello",
] as const;
export type DemoTaskKey = (typeof DEMO_TASK_KEYS)[number];

export type DemoTask = {
  key: DemoTaskKey;
  title: string;
  description: string;
  /** A default column slug, so the board spreads the tasks across columns. */
  status: "to-do" | "in-progress" | "in-review" | "done";
  /** Keys of tasks that must be finished first ("waits on"). */
  waitsOn: DemoTaskKey[];
};

/**
 * The demo board. Every task belongs to the user taking the tour; the tour
 * card tells the teammate story around them. Board order follows this list.
 */
export const DEMO_TASKS: readonly DemoTask[] = [
  {
    key: "design-review",
    title: "Review the checkout design",
    description:
      "A task in review is waiting for someone to look at it. Open it, read the notes, and move it to Done when you are happy.",
    status: "in-review",
    waitsOn: [],
  },
  {
    key: "api-endpoint",
    title: "Build the payments API endpoint",
    description:
      "This task is in progress, and other work waits on it. When you mark it Done, the person waiting on it hears that they can continue.",
    status: "in-progress",
    waitsOn: [],
  },
  {
    key: "write-tests",
    title: "Write tests for the payments API",
    description:
      "This task waits on the API endpoint. It can start now, but it cannot be marked Done until the endpoint is Done.",
    status: "to-do",
    waitsOn: ["api-endpoint"],
  },
  {
    key: "ship-release",
    title: "Ship the payments release",
    description:
      "The last step in the chain: it waits on the tests, which wait on the endpoint. Baton shows who is holding up whom.",
    status: "to-do",
    waitsOn: ["write-tests"],
  },
  {
    key: "mcp-hello",
    title: "Say hello from your AI agent",
    description:
      "Agents use the same board through MCP: they read tasks, create them and move them, with your permissions. Connect one from your profile.",
    status: "done",
    waitsOn: [],
  },
];
