import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import addSubtask from "@/fetchers/board/add-subtask";
import createTaskRelation from "@/fetchers/task-relation/create-task-relation";
import { toast } from "@/lib/toast";
import { useAddSubtask } from "./use-add-subtask";

vi.mock("@/fetchers/board/add-subtask", () => ({ default: vi.fn() }));
vi.mock("@/fetchers/task-relation/create-task-relation", () => ({
  default: vi.fn(),
}));
// i18n is not started in unit tests; the hook's own default text stands in.
vi.mock("i18next", () => ({
  default: { t: (_key: string, o: { defaultValue: string }) => o.defaultValue },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const request = {
  taskId: "feature",
  projectId: "p",
  title: "New",
  blockerIds: ["a", "b"],
};

function setup() {
  const client = new QueryClient();
  const hook = renderHook(useAddSubtask, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  vi.mocked(addSubtask).mockResolvedValue({
    id: "new",
    projectId: "p",
  } as Awaited<ReturnType<typeof addSubtask>>);
  return hook;
}

describe("useAddSubtask", () => {
  it("still links the blockers when the dialog unmounts mid-call", async () => {
    const hook = setup();
    vi.mocked(createTaskRelation).mockResolvedValue(
      {} as Awaited<ReturnType<typeof createTaskRelation>>,
    );
    act(() => hook.result.current.mutate(request));
    hook.unmount();
    await vi.waitFor(() => expect(createTaskRelation).toHaveBeenCalledTimes(2));
    expect(createTaskRelation).toHaveBeenCalledWith({
      sourceTaskId: "a",
      targetTaskId: "new",
      relationType: "blocks",
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("tells the person when some links fail, even after unmount", async () => {
    const hook = setup();
    vi.mocked(createTaskRelation)
      .mockResolvedValueOnce(
        {} as Awaited<ReturnType<typeof createTaskRelation>>,
      )
      .mockRejectedValueOnce(new Error("Would make a loop"));
    act(() => hook.result.current.mutate(request));
    hook.unmount();
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith(expect.any(String), {
      description: "Would make a loop",
    });
  });

  it("makes no links and no toast when the task itself fails", async () => {
    const hook = setup();
    vi.mocked(addSubtask).mockRejectedValue(new Error("nope"));
    await act(async () => {
      await hook.result.current.mutateAsync(request).catch(() => {});
    });
    expect(createTaskRelation).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
