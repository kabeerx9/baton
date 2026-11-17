import { QueryClient, onlineManager } from "@tanstack/react-query";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import { HttpError } from "@/lib/http-error";
import { notifyChangeRequested } from "@/lib/notify-change-requested";
import { entryOf } from "./store";
import { shownStatus } from "./transition";
import type { Target } from "./types";
import { watchTaskReads } from "./watch-reads";
import { chooseStatus, confirmRequests, dismissRequests } from "./write-status";

vi.mock("@/fetchers/task/update-task-status", () => ({ default: vi.fn() }));
vi.mock("@/lib/notify-change-requested", () => ({
  notifyChangeRequested: vi.fn(),
}));

const put = vi.mocked(updateTaskStatus);

const DOING: Target = { status: "in-progress", isFinal: false };
const REVIEW: Target = { status: "in-review", isFinal: false };
const DONE: Target = { status: "done", isFinal: true };

type Call = {
  status: string;
  signal: AbortSignal | undefined;
  applied: (generation: number) => void;
  requested: () => void;
  fail: (error: unknown) => void;
};

/** Each PUT waits until the test answers it. */
function controlPuts() {
  const calls: Call[] = [];
  put.mockImplementation(
    (_id, task, signal) =>
      new Promise((resolve, reject) => {
        calls.push({
          status: task.status,
          signal,
          applied: (generation) =>
            resolve({
              outcome: "applied",
              task: { id: "t", statusGeneration: generation },
            } as never),
          requested: () =>
            resolve({
              outcome: "requested",
              request: { id: "r" },
              task: { id: "t", userId: "neha" },
            } as never),
          fail: reject,
        });
      }),
  );
  return calls;
}

let client: QueryClient;
const click = (target: Target, move: "apply" | "request" | "deny" = "apply") =>
  chooseStatus({ queryClient: client, taskId: "t", target, move, title: "T" });
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));
const shown = (server = "to-do", generation = 3) =>
  shownStatus({ status: server, statusGeneration: generation }, entryOf("t"));

beforeEach(() => {
  client = new QueryClient();
  client.setQueryData(["task", "t"], { id: "t", status: "to-do" });
  vi.spyOn(client, "invalidateQueries");
  vi.spyOn(client, "refetchQueries").mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  onlineManager.setOnline(true);
});

describe("one PUT per task, latest wins", () => {
  it("sends B and D, never C, and shows D throughout", async () => {
    const calls = controlPuts();
    const b = click(DOING);
    expect(shown()).toBe("in-progress");
    const c = click(REVIEW);
    expect(shown()).toBe("in-review");
    const d = click(DONE);
    expect(shown()).toBe("done");
    expect(calls.map((x) => x.status)).toEqual(["in-progress"]);

    calls[0]!.applied(4);
    await expect(b).resolves.toEqual({ outcome: "applied" });
    await settled();
    // The shown status never fell back to the server value in between.
    expect(shown()).toBe("done");
    expect(calls.map((x) => x.status)).toEqual(["in-progress", "done"]);
    await expect(c).resolves.toEqual({ outcome: "superseded" });

    calls[1]!.applied(5);
    await expect(d).resolves.toEqual({ outcome: "applied" });
    expect(put).toHaveBeenCalledTimes(2);
  });

  it("sends nothing when a click goes back to the target in flight", async () => {
    const calls = controlPuts();
    const first = click(DOING);
    const second = click(DONE);
    const back = click(DOING);
    expect(calls).toHaveLength(1);
    await expect(second).resolves.toEqual({ outcome: "superseded" });

    calls[0]!.applied(4);
    await expect(first).resolves.toEqual({ outcome: "applied" });
    await expect(back).resolves.toEqual({ outcome: "applied" });
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("puts a deadline on the call", async () => {
    const calls = controlPuts();
    void click(DOING);
    expect(calls[0]!.signal).toBeInstanceOf(AbortSignal);
  });

  it("runs the invalidations once per chain, not once per click", async () => {
    const calls = controlPuts();
    const clicks = [click(DOING), click(REVIEW), click(DONE)];
    calls[0]!.applied(4);
    await settled();
    calls[1]!.applied(5);
    await Promise.all(clicks);
    await settled();
    const keys = vi
      .mocked(client.invalidateQueries)
      .mock.calls.map(([filter]) => JSON.stringify(filter?.queryKey));
    expect(keys.filter((k) => k === '["task-board"]')).toHaveLength(1);
    expect(keys.filter((k) => k === '["task","t"]')).toHaveLength(1);
  });

  it("gives two controls of one task one PUT at a time", async () => {
    const calls = controlPuts();
    void click(DOING);
    void click(REVIEW);
    expect(calls).toHaveLength(1);
  });
});

describe("a request is not an optimistic move", () => {
  it("opens one modal for two request controls and sends one request", async () => {
    const calls = controlPuts();
    const first = click(DONE, "request");
    const second = click(DONE, "request");
    expect(entryOf("t").kind).toBe("confirming");
    expect(calls).toHaveLength(0);
    // The status does not move while the modal waits.
    expect(shown()).toBe("to-do");

    confirmRequests(client);
    expect(entryOf("t").kind).toBe("asking");
    expect(shown()).toBe("to-do");
    expect(calls).toHaveLength(1);
    // A third click while the request flies is not queued: it shares the one request.
    const third = click(REVIEW, "request");
    expect(calls).toHaveLength(1);

    calls[0]!.requested();
    await expect(first).resolves.toEqual({ outcome: "requested" });
    await expect(second).resolves.toEqual({ outcome: "requested" });
    await expect(third).resolves.toEqual({ outcome: "requested" });
    expect(notifyChangeRequested).toHaveBeenCalledTimes(1);
    expect(entryOf("t").kind).toBe("idle");
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("drops a request click while a send is in flight", async () => {
    // Only an "apply" click joins the queue. A request needs its own
    // confirmation, so it is not queued behind the PUT and not sent.
    const calls = controlPuts();
    const first = click(DOING);
    const request = click(DONE, "request");
    await expect(request).resolves.toEqual({ outcome: "superseded" });
    expect(calls).toHaveLength(1);
    expect(entryOf("t").kind).toBe("sending");
    calls[0]!.applied(4);
    await expect(first).resolves.toEqual({ outcome: "applied" });
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("shows one toast for a bulk request", async () => {
    const calls = controlPuts();
    const bulk = (taskId: string) =>
      chooseStatus({
        queryClient: client,
        taskId,
        target: DONE,
        move: "request",
        title: taskId,
      });
    const results = [bulk("a"), bulk("b")];
    confirmRequests(client);
    expect(calls).toHaveLength(2);
    calls.forEach((call) => call.requested());
    await Promise.all(results);
    await settled();
    expect(notifyChangeRequested).toHaveBeenCalledTimes(1);
  });

  it("sends nothing on cancel and settles every caller", async () => {
    controlPuts();
    const first = click(DONE, "request");
    const second = click(DONE, "request");
    dismissRequests();
    await expect(first).resolves.toEqual({ outcome: "superseded" });
    await expect(second).resolves.toEqual({ outcome: "superseded" });
    expect(put).not.toHaveBeenCalled();
    expect(entryOf("t").kind).toBe("idle");
  });

  it("does not send the queued target after a request", async () => {
    const calls = controlPuts();
    const first = click(DOING);
    const second = click(DONE);
    calls[0]!.requested();
    await expect(first).resolves.toEqual({ outcome: "requested" });
    await expect(second).resolves.toEqual({ outcome: "superseded" });
    await settled();
    expect(put).toHaveBeenCalledTimes(1);
    expect(entryOf("t").kind).toBe("idle");
    expect(shown()).toBe("to-do");
  });

  it("shows the change when the server applies a predicted request", async () => {
    const calls = controlPuts();
    const first = click(DONE, "request");
    confirmRequests(client);
    calls[0]!.applied(4);
    await expect(first).resolves.toEqual({ outcome: "applied" });
    expect(shown("to-do", 3)).toBe("done");
  });

  it("ignores a click on a denied task", async () => {
    controlPuts();
    await expect(click(DONE, "deny")).resolves.toEqual({
      outcome: "superseded",
    });
    expect(put).not.toHaveBeenCalled();
    expect(entryOf("t").kind).toBe("idle");
  });
});

describe("a refusal", () => {
  it("returns to the server value and rejects the latest intent for its toast", async () => {
    const calls = controlPuts();
    const first = click(DONE);
    expect(shown()).toBe("done");
    calls[0]!.fail(new HttpError(409, "Waiting on API-3."));
    await expect(first).rejects.toThrow("Waiting on API-3.");
    expect(shown()).toBe("to-do");
    expect(entryOf("t").kind).toBe("idle");
  });

  it("sends the queued target and shows no error for the failed one", async () => {
    const calls = controlPuts();
    const first = click(DONE);
    const second = click(DOING);
    calls[0]!.fail(new HttpError(409, "Waiting on API-3."));
    await expect(first).resolves.toEqual({ outcome: "superseded" });
    await settled();
    expect(calls.map((x) => x.status)).toEqual(["done", "in-progress"]);
    expect(shown()).toBe("in-progress");
    calls[1]!.applied(4);
    await expect(second).resolves.toEqual({ outcome: "applied" });
  });
});

describe("the write may have committed", () => {
  const timeout = () => new DOMException("signal timed out", "TimeoutError");

  it("locks the task on a timeout, shows the server value and resends nothing", async () => {
    const calls = controlPuts();
    const first = click(DONE);
    const queued = click(DOING);
    calls[0]!.fail(timeout());
    await expect(first).rejects.toThrow();
    await expect(queued).resolves.toEqual({ outcome: "superseded" });
    await settled();
    expect(entryOf("t").kind).toBe("uncertain");
    expect(shown()).toBe("to-do");
    expect(put).toHaveBeenCalledTimes(1);
    // The task is read at once, and every view reloads once.
    expect(client.refetchQueries).toHaveBeenCalledWith({
      queryKey: ["task", "t"],
    });
    const boardInvalidations = vi
      .mocked(client.invalidateQueries)
      .mock.calls.filter(
        ([filter]) => JSON.stringify(filter?.queryKey) === '["task-board"]',
      );
    expect(boardInvalidations).toHaveLength(1);
    // The task is fetched once: the chain settle does not invalidate it again.
    expect(
      vi
        .mocked(client.refetchQueries)
        .mock.calls.filter(
          ([filter]) => JSON.stringify(filter?.queryKey) === '["task","t"]',
        ),
    ).toHaveLength(1);
    expect(
      vi
        .mocked(client.invalidateQueries)
        .mock.calls.filter(
          ([filter]) => JSON.stringify(filter?.queryKey) === '["task","t"]',
        ),
    ).toHaveLength(0);
    // A click on a locked task is ignored.
    await expect(click(REVIEW)).resolves.toEqual({ outcome: "superseded" });
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("reads a 5xx and a network error the same way", async () => {
    for (const error of [
      new HttpError(503, "down"),
      new Error("Failed to connect to API server"),
    ]) {
      put.mockRejectedValueOnce(error);
      await expect(click(DOING)).rejects.toThrow();
      expect(entryOf("t").kind).toBe("uncertain");
      const { resetTaskStatusStore } = await import("./store");
      resetTaskStatusStore();
    }
  });

  it("unlocks on the next successful read of the task, even after a failed recovery read", async () => {
    const stop = watchTaskReads(client);
    put.mockRejectedValueOnce(timeout());
    await expect(click(DONE)).rejects.toThrow();
    expect(entryOf("t").kind).toBe("uncertain");

    // Writing the cache by hand is no read.
    client.setQueryData(["task", "t"], { id: "t", status: "to-do" });
    expect(entryOf("t").kind).toBe("uncertain");

    // A later read, however it arrives, does.
    await client.fetchQuery({
      queryKey: ["task", "t"],
      queryFn: async () => ({ id: "t", status: "done" }),
      staleTime: 0,
    });
    expect(entryOf("t").kind).toBe("idle");
    stop();
  });

  it("stays locked when a read that started before the failure resolves after it", async () => {
    // Seeded data is stamped with the real clock, so the fake one starts later.
    const start = Date.now() + 10_000;
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const stop = watchTaskReads(client);
      vi.setSystemTime(start);
      let finish!: (value: unknown) => void;
      const inFlight = client.fetchQuery({
        queryKey: ["task", "t"],
        queryFn: () => new Promise((resolve) => (finish = resolve)),
        staleTime: 0,
      });
      await settled();
      vi.setSystemTime(start + 1000);
      put.mockRejectedValueOnce(timeout());
      await expect(click(DONE)).rejects.toThrow();
      expect(entryOf("t").kind).toBe("uncertain");

      // The server answered this read before the write was sent.
      finish({ id: "t", status: "to-do", statusGeneration: 3 });
      await inFlight;
      expect(entryOf("t").kind).toBe("uncertain");

      // A read issued after the failure lifts the lock.
      vi.setSystemTime(start + 2000);
      await client.fetchQuery({
        queryKey: ["task", "t"],
        queryFn: async () => ({ id: "t", status: "done", statusGeneration: 4 }),
        staleTime: 0,
      });
      expect(entryOf("t").kind).toBe("idle");
      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("unlocks on a board read that carries the task", async () => {
    const stop = watchTaskReads(client);
    put.mockRejectedValueOnce(timeout());
    await expect(click(DONE)).rejects.toThrow();
    await client.fetchQuery({
      queryKey: ["task-board", "w"],
      queryFn: async () => ({
        tasks: [{ id: "f", subtasks: [{ id: "t" }] }],
      }),
      staleTime: 0,
    });
    expect(entryOf("t").kind).toBe("idle");
    stop();
  });

  it("stays honest when the old PUT commits after the recovery read", async () => {
    const stop = watchTaskReads(client);
    put.mockRejectedValueOnce(timeout());
    await expect(click(DONE)).rejects.toThrow();
    // Recovery read: the server still says to-do at generation 3.
    await client.fetchQuery({
      queryKey: ["task", "t"],
      queryFn: async () => ({ id: "t", status: "to-do", statusGeneration: 3 }),
      staleTime: 0,
    });
    expect(entryOf("t").kind).toBe("idle");

    // The person clicks again. This write is acknowledged as generation 4.
    const calls = controlPuts();
    const second = click(DOING);
    calls[0]!.applied(4);
    await expect(second).resolves.toEqual({ outcome: "applied" });
    expect(shown("to-do", 3)).toBe("in-progress");
    // The old PUT lands after it: the server says done at generation 5.
    // Latest-wins holds only for acknowledged writes (R1.3): the server value shows.
    expect(shown("done", 5)).toBe("done");
    // A stale read keeps the acknowledged target, not the old value.
    expect(shown("to-do", 3)).toBe("in-progress");
    stop();
  });
});

describe("offline", () => {
  it("shows the click at once, fails the call, and sends nothing on reconnect", async () => {
    onlineManager.setOnline(false);
    put.mockRejectedValueOnce(new Error("Failed to connect to API server"));
    const result = click(DONE);
    expect(shown()).toBe("done");
    await expect(result).rejects.toThrow();
    expect(shown()).toBe("to-do");
    onlineManager.setOnline(true);
    await settled();
    expect(put).toHaveBeenCalledTimes(1);
  });
});

describe("confirmed", () => {
  it("shows the target until a read reaches the generation, then the server wins", async () => {
    const calls = controlPuts();
    const first = click(DONE);
    calls[0]!.applied(4);
    await first;
    expect(entryOf("t").kind).toBe("confirmed");
    // A read from before the write.
    expect(shown("to-do", 3)).toBe("done");
    // A read at the write's generation or later: the server wins, even over us.
    expect(shown("done", 4)).toBe("done");
    expect(shown("in-review", 6)).toBe("in-review");
  });

  it("drops the entry once a read reaches the generation", async () => {
    const stop = watchTaskReads(client);
    const calls = controlPuts();
    const first = click(DONE);
    calls[0]!.applied(4);
    await first;
    const read = (statusGeneration: number) =>
      client.fetchQuery({
        queryKey: ["task", "t"],
        queryFn: async () => ({ id: "t", status: "to-do", statusGeneration }),
        staleTime: 0,
      });
    await read(3);
    expect(entryOf("t").kind).toBe("confirmed");
    await read(4);
    expect(entryOf("t").kind).toBe("idle");
    stop();
  });
});
