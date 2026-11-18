import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Timeline } from "@/components/ui/timeline";
import Activity from "./index";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "w" } }),
}));
vi.mock("@/hooks/queries/workspace-users/use-get-workspace-users", () => ({
  default: () => ({
    data: [
      { id: "rohan", name: "Rohan", email: "", image: null, role: "member" },
    ],
  }),
}));

afterEach(cleanup);

function renderActivity(channel: "web" | "agent" | null | undefined) {
  render(
    <Timeline>
      <Activity
        activity={{
          id: "a1",
          taskId: "t1",
          type: "status_changed",
          content: null,
          eventData: { oldStatus: "to-do", newStatus: "done" },
          createdAt: new Date().toISOString(),
          userId: "rohan",
          channel,
        }}
        step={1}
      />
    </Timeline>,
  );
}

describe("activity channel badge", () => {
  it("marks an agent's action", () => {
    renderActivity("agent");
    expect(screen.getAllByText("common:channel.agent")).toHaveLength(1);
  });

  it.each(["web", null, undefined] as const)(
    "shows nothing for %s",
    (channel) => {
      renderActivity(channel);
      expect(screen.queryByText("common:channel.agent")).toBeNull();
    },
  );
});
