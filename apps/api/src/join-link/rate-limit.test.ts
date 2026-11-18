import { describe, expect, it } from "vite-plus/test";
import { createFixedWindowLimiter } from "./rate-limit";

describe("createFixedWindowLimiter", () => {
  it("allows up to the limit, then refuses with the seconds left", () => {
    const limiter = createFixedWindowLimiter({ limit: 2, windowMs: 60_000 });
    expect(limiter.hit("a", 0)).toEqual({ kind: "allowed" });
    expect(limiter.hit("a", 1_000)).toEqual({ kind: "allowed" });
    expect(limiter.hit("a", 1_500)).toEqual({
      kind: "limited",
      retryAfterSeconds: 59,
    });
  });

  it("keeps keys apart", () => {
    const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.hit("a", 0).kind).toBe("allowed");
    expect(limiter.hit("b", 0).kind).toBe("allowed");
    expect(limiter.hit("a", 0).kind).toBe("limited");
  });

  it("opens a new window once the old one ends", () => {
    const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 60_000 });
    limiter.hit("a", 0);
    expect(limiter.hit("a", 59_999).kind).toBe("limited");
    expect(limiter.hit("a", 60_000).kind).toBe("allowed");
  });

  it("never asks for less than one second", () => {
    const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 60_000 });
    limiter.hit("a", 0);
    expect(limiter.hit("a", 59_999)).toEqual({
      kind: "limited",
      retryAfterSeconds: 1,
    });
  });

  it("clears the map when it reaches 10 000 keys", () => {
    const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 60_000 });
    for (let index = 0; index < 10_000; index += 1)
      limiter.hit(`key-${index}`, 0);
    expect(limiter.size()).toBe(10_000);
    limiter.hit("one-more", 0);
    expect(limiter.size()).toBe(1);
  });

  it("forgets every window on reset", () => {
    const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 60_000 });
    limiter.hit("a", 0);
    limiter.reset();
    expect(limiter.hit("a", 0).kind).toBe("allowed");
  });
});
