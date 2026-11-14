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

describe("notifyChangeRequested", () => {
  it("names the assignee", () => {
    notifyChangeRequested({ assigneeName: "Neha" });
    expect(toast.info).toHaveBeenCalledWith(
      'tasks:changeRequest.requestedTo:{"names":"Neha"}',
    );
  });

  it("uses the general message when nobody is assigned", () => {
    notifyChangeRequested({ assigneeName: null });
    notifyChangeRequested(undefined);
    expect(toast.info).toHaveBeenNthCalledWith(
      1,
      "tasks:changeRequest.requested",
    );
    expect(toast.info).toHaveBeenNthCalledWith(
      2,
      "tasks:changeRequest.requested",
    );
  });
});
