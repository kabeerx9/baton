import { describe, expect, it } from "vite-plus/test";
import {
  INITIAL_QUEUE,
  orderQueue,
  pinnedId,
  type QueueEvent,
  type QueueOrder,
  queueTransition,
} from "./queue-order";

const ranked = ["a", "b", "c", "d"].map((id) => ({ id }));
const run = (...events: QueueEvent[]): QueueOrder =>
  events.reduce(queueTransition, INITIAL_QUEUE);
const order = (state: QueueOrder) => orderQueue(ranked, state).map((t) => t.id);

describe("queueTransition", () => {
  it("leaves the ranked order alone until something happens", () => {
    expect(order(INITIAL_QUEUE)).toEqual(["a", "b", "c", "d"]);
    expect(pinnedId(INITIAL_QUEUE)).toBeNull();
  });

  it("puts a pinned task first and keeps one pin at a time", () => {
    const state = run({ type: "pin", id: "c" }, { type: "pin", id: "d" });
    expect(pinnedId(state)).toBe("d");
    expect(order(state)).toEqual(["d", "a", "b", "c"]);
  });

  it("sends skipped tasks to the back in the order they were skipped", () => {
    const state = run(
      { type: "skip", id: "b" },
      { type: "skip", id: "a" },
      { type: "skip", id: "b" },
    );
    expect(order(state)).toEqual(["c", "d", "a", "b"]);
  });

  it("unpins a task that is skipped, and unskips one that is pinned", () => {
    const skipped = run({ type: "pin", id: "a" }, { type: "skip", id: "a" });
    expect(pinnedId(skipped)).toBeNull();
    expect(order(skipped)).toEqual(["b", "c", "d", "a"]);
    const pinned = run({ type: "skip", id: "a" }, { type: "pin", id: "a" });
    expect(order(pinned)).toEqual(["a", "b", "c", "d"]);
  });

  it("returns a released task to its rank", () => {
    const state = run({ type: "skip", id: "a" }, { type: "release", id: "a" });
    expect(order(state)).toEqual(["a", "b", "c", "d"]);
  });

  it("returns the same state for a release of an unknown task or an unknown event", () => {
    const state = run({ type: "pin", id: "a" });
    expect(queueTransition(state, { type: "release", id: "zzz" })).toBe(state);
    expect(queueTransition(state, { type: "nope" } as never)).toBe(state);
  });

  it("ignores positions of tasks that left the list", () => {
    const state = run(
      { type: "pin", id: "gone" },
      { type: "skip", id: "gone2" },
    );
    expect(order(state)).toEqual(["a", "b", "c", "d"]);
  });
});
