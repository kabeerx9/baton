import { describe, expect, it } from "vite-plus/test";
import { nextEnabledIndex } from "./toggle-group-focus";

const horizontal = {
  loop: true,
  orientation: "horizontal",
  rtl: false,
} as const;

describe("nextEnabledIndex", () => {
  it("steps forward and backward", () => {
    expect(
      nextEnabledIndex({
        ...horizontal,
        count: 3,
        index: 0,
        key: "ArrowRight",
      }),
    ).toBe(1);
    expect(
      nextEnabledIndex({ ...horizontal, count: 3, index: 2, key: "ArrowLeft" }),
    ).toBe(1);
  });

  it("wraps at both ends when it loops", () => {
    expect(
      nextEnabledIndex({
        ...horizontal,
        count: 3,
        index: 2,
        key: "ArrowRight",
      }),
    ).toBe(0);
    expect(
      nextEnabledIndex({ ...horizontal, count: 3, index: 0, key: "ArrowLeft" }),
    ).toBe(2);
  });

  it("stays at the end when it does not loop", () => {
    expect(
      nextEnabledIndex({
        ...horizontal,
        loop: false,
        count: 3,
        index: 2,
        key: "ArrowRight",
      }),
    ).toBe(2);
    expect(
      nextEnabledIndex({
        ...horizontal,
        loop: false,
        count: 3,
        index: 0,
        key: "ArrowLeft",
      }),
    ).toBe(0);
  });

  it("goes to the first and last enabled item for Home and End", () => {
    expect(
      nextEnabledIndex({ ...horizontal, count: 4, index: 2, key: "Home" }),
    ).toBe(0);
    expect(
      nextEnabledIndex({ ...horizontal, count: 4, index: 1, key: "End" }),
    ).toBe(3);
  });

  it("uses the vertical arrows in a vertical group", () => {
    const vertical = { ...horizontal, orientation: "vertical" } as const;
    expect(
      nextEnabledIndex({ ...vertical, count: 3, index: 0, key: "ArrowDown" }),
    ).toBe(1);
    expect(
      nextEnabledIndex({ ...vertical, count: 3, index: 2, key: "ArrowUp" }),
    ).toBe(1);
    expect(
      nextEnabledIndex({ ...vertical, count: 3, index: 0, key: "ArrowRight" }),
    ).toBeNull();
    expect(
      nextEnabledIndex({ ...horizontal, count: 3, index: 0, key: "ArrowDown" }),
    ).toBeNull();
  });

  it("swaps the horizontal arrows in right-to-left text", () => {
    const rtl = { ...horizontal, rtl: true } as const;
    expect(
      nextEnabledIndex({ ...rtl, count: 3, index: 0, key: "ArrowLeft" }),
    ).toBe(1);
    expect(
      nextEnabledIndex({ ...rtl, count: 3, index: 2, key: "ArrowRight" }),
    ).toBe(1);
  });

  it("leaves other keys and empty or out-of-range lists alone", () => {
    expect(
      nextEnabledIndex({ ...horizontal, count: 3, index: 0, key: "Enter" }),
    ).toBeNull();
    expect(
      nextEnabledIndex({ ...horizontal, count: 3, index: 0, key: " " }),
    ).toBeNull();
    expect(
      nextEnabledIndex({
        ...horizontal,
        count: 0,
        index: 0,
        key: "ArrowRight",
      }),
    ).toBeNull();
    expect(
      nextEnabledIndex({
        ...horizontal,
        count: 3,
        index: -1,
        key: "ArrowRight",
      }),
    ).toBeNull();
    expect(
      nextEnabledIndex({
        ...horizontal,
        count: 3,
        index: 3,
        key: "ArrowRight",
      }),
    ).toBeNull();
  });
});
