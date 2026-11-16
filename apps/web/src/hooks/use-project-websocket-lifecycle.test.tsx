import { act, cleanup, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useProjectWebSocket } from "./use-project-websocket";

const { client, auth } = vi.hoisted(() => ({
  client: {
    getQueryCache: () => ({ subscribe: () => () => {}, findAll: () => [] }),
    getQueryState: vi.fn(),
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    setQueriesData: vi.fn(),
    getQueriesData: vi.fn().mockReturnValue([]),
    getQueryData: vi.fn(),
  },
  auth: { userId: "user-a" as string | null },
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => client }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: auth.userId ? { user: { id: auth.userId } } : null,
    }),
  },
}));
vi.mock("@baton/libs", () => ({ windowId: "local-test" }));

class TestSocket {
  static OPEN = 1;
  static instances: TestSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  send = vi.fn();
  // Deliberately delay close events to reproduce the project-switch race.
  close = vi.fn(() => {
    this.readyState = 3;
  });
  constructor(public url: string) {
    TestSocket.instances.push(this);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}

describe("project WebSocket lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", TestSocket);
    vi.stubEnv("VITE_API_URL", "http://localhost:1337");
    TestSocket.instances = [];
    auth.userId = "user-a";
    client.invalidateQueries.mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("ignores late old-project events without stopping the new project's keepalive", () => {
    const { rerender, unmount } = renderHook(
      ({ id }) => useProjectWebSocket(id),
      {
        initialProps: { id: "project-a" },
      },
    );
    const old = TestSocket.instances[0];
    act(() => old.open());
    rerender({ id: "project-b" });
    const current = TestSocket.instances[1];
    act(() => {
      current.open();
      old.onclose?.();
      old.onopen?.();
      old.onmessage?.({
        data: JSON.stringify({
          type: "TASK_UPDATED",
          projectId: "project-a",
          taskId: "old-task",
        }),
      });
      vi.advanceTimersByTime(30_000);
    });
    expect(
      TestSocket.instances.map((socket) => new URL(socket.url).pathname),
    ).toEqual(["/api/ws/project-a", "/api/ws/project-b"]);
    expect(old.close).toHaveBeenCalledOnce();
    expect(old.send).not.toHaveBeenCalled();
    expect(current.send).toHaveBeenCalledWith('{"type":"ping"}');
    expect(client.invalidateQueries).not.toHaveBeenCalled();
    unmount();
    act(() => current.onclose?.());
    expect(current.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels scheduled reconnects on logout and starts a fresh connection on login", () => {
    const { rerender, unmount } = renderHook(() =>
      useProjectWebSocket("project-a"),
    );
    act(() => TestSocket.instances[0].onclose?.());
    expect(vi.getTimerCount()).toBe(1);
    auth.userId = null;
    rerender();
    act(() => vi.advanceTimersByTime(60_000));
    expect(TestSocket.instances).toHaveLength(1);
    auth.userId = "user-b";
    rerender();
    expect(TestSocket.instances).toHaveLength(2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("refreshes project and task caches when the workspace changes", () => {
    renderHook(() => useProjectWebSocket("project-a"));
    act(() =>
      TestSocket.instances[0].onmessage?.({
        data: JSON.stringify({ type: "PROJECT_MOVED", projectId: "project-a" }),
      }),
    );
    for (const queryKey of [
      ["projects"],
      ["project", "project-a"],
      ["tasks", "project-a"],
      ["task"],
      ["task-relations"],
    ]) {
      expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey });
    }
  });

  it("refreshes task resources after a task move", () => {
    renderHook(() => useProjectWebSocket("project-a"));
    act(() =>
      TestSocket.instances[0].onmessage?.({
        data: JSON.stringify({
          type: "TASK_MOVED",
          projectId: "project-a",
          taskId: "task-a",
        }),
      }),
    );
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["external-links", "task-a"],
    });
  });

  it("keeps reconnecting at the cap, polls while degraded and stops polling on open", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { unmount } = renderHook(() => useProjectWebSocket("project-a"));
    const polled = () =>
      client.invalidateQueries.mock.calls.filter(
        ([filters]) =>
          (filters as { queryKey: unknown[] }).queryKey[0] === "tasks",
      ).length;
    for (const [retry, delay] of [
      750, 1250, 2250, 4250, 8250, 15250, 15250, 15250,
    ].entries()) {
      act(() => {
        TestSocket.instances.at(-1)?.open();
        TestSocket.instances.at(-1)?.onclose?.();
        vi.advanceTimersByTime(delay - 1);
      });
      expect(TestSocket.instances).toHaveLength(retry + 1);
      act(() => vi.advanceTimersByTime(1));
      expect(TestSocket.instances).toHaveLength(retry + 2);
    }
    // Four reconnects in, the fifth failure started the poll.
    client.invalidateQueries.mockClear();
    act(() => vi.advanceTimersByTime(30_000));
    expect(polled()).toBeGreaterThanOrEqual(1);
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["task-relations", "project", "project-a"],
    });
    const last = TestSocket.instances.at(-1);
    act(() => last?.open());
    client.invalidateQueries.mockClear();
    // Past any poll deadline, but before the 30 s stable timer.
    act(() => vi.advanceTimersByTime(29_999));
    expect(client.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ["task-relations", "project", "project-a"],
    });
    act(() => {
      last?.onmessage?.({
        data: JSON.stringify({
          type: "TASK_UPDATED",
          projectId: "project-a",
          taskId: "task-a",
        }),
      });
    });
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["task", "task-a"],
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("unmounting leaves no timers and no window listeners", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const added = vi.spyOn(window, "addEventListener");
    const removed = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useProjectWebSocket("project-a"));
    act(() => {
      TestSocket.instances[0].open();
      TestSocket.instances[0].onclose?.();
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    const types = (calls: unknown[][]) =>
      calls.map(([type]) => type).filter((t) => t === "online");
    expect(types(removed.mock.calls)).toEqual(types(added.mock.calls));
  });

  it("reconnects within a second when the browser comes back online", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    renderHook(() => useProjectWebSocket("project-a"));
    for (let failure = 0; failure < 4; failure++)
      act(() => {
        TestSocket.instances.at(-1)?.onclose?.();
        vi.advanceTimersByTime(30_000);
      });
    act(() => TestSocket.instances.at(-1)?.onclose?.());
    const before = TestSocket.instances.length;
    act(() => {
      window.dispatchEvent(new Event("online"));
      vi.advanceTimersByTime(1000);
    });
    expect(TestSocket.instances).toHaveLength(before + 1);
    act(() => {
      window.dispatchEvent(new Event("online"));
      vi.advanceTimersByTime(1000);
    });
    expect(TestSocket.instances).toHaveLength(before + 1);
  });
});
