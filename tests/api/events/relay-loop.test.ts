import { describe, expect, it, vi } from "vite-plus/test";
import type { ClaimedRow } from "../../../apps/api/src/events/outbox/claim";
import { nudgeOutbox } from "../../../apps/api/src/events/outbox/nudge";
import { publishLive } from "../../../apps/api/src/events/index";
import {
  drainLane,
  startLoop,
} from "../../../apps/api/src/events/outbox/start-relay";

const claimed = (id: string) =>
  ({
    row: { id, consumer: "activity" },
    ageMs: 0,
    claimedAt: 0,
  }) as unknown as ClaimedRow;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("drainLane", () => {
  it("claims again while rows return and runs local rows in sequence", async () => {
    const batches = [[claimed("a"), claimed("b")], [claimed("c")], []];
    const order: string[] = [];
    const claim = vi.fn(async () => batches.shift() ?? []);
    const deliver = vi.fn(async (c: ClaimedRow) => {
      order.push(`start ${c.row.id}`);
      await Promise.resolve();
      order.push(`end ${c.row.id}`);
      return "delivered" as const;
    });
    expect(await drainLane("local", { claim, deliver })).toBe(3);
    expect(claim).toHaveBeenCalledWith(["activity"], 10);
    expect(order).toEqual([
      "start a",
      "end a",
      "start b",
      "end b",
      "start c",
      "end c",
    ]);
    expect(deliver).toHaveBeenCalledWith(expect.anything(), {
      timeoutMs: 5_000,
    });
  });

  it("keeps going when recording one outcome fails", async () => {
    const batches = [[claimed("a"), claimed("b")], []];
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const deliver = vi
      .fn()
      .mockRejectedValueOnce(new Error("db"))
      .mockResolvedValueOnce("delivered");
    expect(
      await drainLane("local", {
        claim: async () => batches.shift() ?? [],
        deliver,
      }),
    ).toBe(2);
    expect(deliver).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});

describe("drainLane stop", () => {
  it("claims no batch after stop", async () => {
    let stopped = false;
    const claim = vi.fn(async () => [claimed("a")]);
    const deliver = vi.fn(async () => {
      stopped = true;
      return "delivered" as const;
    });
    expect(await drainLane("local", { claim, deliver }, () => stopped)).toBe(1);
    expect(claim).toHaveBeenCalledTimes(1);
  });
});

describe("startLoop", () => {
  it("runs one tick at a time and runs once more after a nudge during a run", async () => {
    const gate = deferred();
    let runs = 0;
    const run = vi.fn(async () => {
      runs++;
      if (runs === 1) await gate.promise;
    });
    const stop = startLoop(run, { pollMs: 60_000, label: "test" });
    expect(run).toHaveBeenCalledTimes(1);
    nudgeOutbox();
    nudgeOutbox();
    expect(run).toHaveBeenCalledTimes(1);
    gate.resolve();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await stop();
    nudgeOutbox();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("survives a failing run (database down) and runs again", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("payload text"), { code: "ECONNREFUSED" }),
      )
      .mockResolvedValue(undefined);
    const stop = startLoop(run, { pollMs: 10, label: "test" });
    await vi.waitFor(() => expect(run.mock.calls.length).toBeGreaterThan(1));
    await stop();
    expect(log).toHaveBeenCalledWith(
      "Outbox test relay failed",
      "ECONNREFUSED",
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("payload text");
    log.mockRestore();
  });

  it("waits for the in-flight run when stopped", async () => {
    const gate = deferred();
    let finished = false;
    const stop = startLoop(
      async () => {
        await gate.promise;
        finished = true;
      },
      { pollMs: 60_000, label: "test" },
    );
    let stopped = false;
    const stopping = stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    gate.resolve();
    await stopping;
    expect(finished).toBe(true);
  });
});

describe("nudge", () => {
  it("wakes the relay for a durable event and not for a live-only one", async () => {
    const run = vi.fn(async () => undefined);
    const stop = startLoop(run, { pollMs: 60_000, label: "test" });
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    await publishLive("tasks.reordered", { projectId: "p" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(run).toHaveBeenCalledTimes(1);
    await publishLive("task.status_changed", { taskId: "t", projectId: "p" });
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await stop();
  });
});
