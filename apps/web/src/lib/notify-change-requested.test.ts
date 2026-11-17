import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { toast } from "@/lib/toast";
import { notifyChangeRequested } from "./notify-change-requested";

vi.mock("i18next", () => ({
  default: {
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  },
}));
vi.mock("@/lib/toast", () => ({ toast: { info: vi.fn() } }));

afterEach(() => vi.clearAllMocks());

function clientWithBoard() {
  const client = new QueryClient();
  client.setQueryData(["task-board", "w"], {
    members: [{ id: "neha", name: "Neha" }],
  });
  return client;
}

describe("notifyChangeRequested", () => {
  it("names the assignee the board knows", () => {
    notifyChangeRequested(clientWithBoard(), { userId: "neha" });
    expect(toast.info).toHaveBeenCalledWith(
      'tasks:changeRequest.requestedTo:{"names":"Neha"}',
    );
  });

  it("uses the general message when nobody is assigned or the name is unknown", () => {
    notifyChangeRequested(clientWithBoard(), { userId: null });
    notifyChangeRequested(clientWithBoard(), { userId: "someone-else" });
    notifyChangeRequested(new QueryClient());
    expect(toast.info).toHaveBeenCalledTimes(3);
    for (const call of vi.mocked(toast.info).mock.calls)
      expect(call[0]).toBe("tasks:changeRequest.requested");
  });

  it("reads past an item read, which has no member list", () => {
    const client = clientWithBoard();
    client.setQueryData(["task-board", "w", "item", "t1"], { task: null });
    notifyChangeRequested(client, { userId: "neha" });
    expect(toast.info).toHaveBeenCalledWith(
      'tasks:changeRequest.requestedTo:{"names":"Neha"}',
    );
  });
});
