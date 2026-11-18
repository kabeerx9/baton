import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  forgetWorkspace,
  readRememberedWorkspace,
  rememberWorkspace,
  subscribeRememberedWorkspace,
} from "./remembered-workspace";

const KEY = "baton:last-workspace:u1";

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("remembered workspace", () => {
  it("prefers this tab's choice over the shared one", () => {
    sessionStorage.setItem(KEY, "tab");
    localStorage.setItem(KEY, "other-tab");
    expect(readRememberedWorkspace("u1")).toBe("tab");
  });

  it("seeds a new tab from localStorage and pins it to the tab", () => {
    localStorage.setItem(KEY, "shared");
    expect(readRememberedWorkspace("u1")).toBe("shared");
    localStorage.setItem(KEY, "later");
    expect(readRememberedWorkspace("u1")).toBe("shared");
  });

  it("keeps users apart", () => {
    rememberWorkspace("u1", "a");
    expect(readRememberedWorkspace("u2")).toBeNull();
  });

  it("writes both stores and notifies only on a change", () => {
    const listener = vi.fn();
    const stop = subscribeRememberedWorkspace(listener);
    rememberWorkspace("u1", "a");
    rememberWorkspace("u1", "a");
    stop();
    expect(sessionStorage.getItem(KEY)).toBe("a");
    expect(localStorage.getItem(KEY)).toBe("a");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("forgets only the named workspace", () => {
    rememberWorkspace("u1", "a");
    forgetWorkspace("u1", "b");
    expect(readRememberedWorkspace("u1")).toBe("a");
    forgetWorkspace("u1", "a");
    forgetWorkspace("u1", "a");
    expect(readRememberedWorkspace("u1")).toBeNull();
  });

  it("survives blocked storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => rememberWorkspace("u1", "a")).not.toThrow();
    expect(readRememberedWorkspace("u1")).toBeNull();
  });
});
