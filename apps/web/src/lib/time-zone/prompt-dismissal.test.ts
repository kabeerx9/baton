import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { readDismissed, writeDismissed } from "./prompt-dismissal";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("prompt dismissal", () => {
  it("round-trips per user in the browser scope", () => {
    writeDismissed("u1", "Europe/London", "browser");
    expect(readDismissed("u1")).toBe("Europe/London");
    expect(readDismissed("u2")).toBeNull();
    expect(window.localStorage.getItem("baton:time-zone-prompt:u1")).toBe(
      "Europe/London",
    );
  });

  it("keeps the session scope out of localStorage", () => {
    writeDismissed("u1", "Asia/Kolkata", "session");
    expect(readDismissed("u1")).toBe("Asia/Kolkata");
    expect(window.localStorage.getItem("baton:time-zone-prompt:u1")).toBeNull();
  });

  it("is safe when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(readDismissed("u1")).toBeNull();
    expect(() => writeDismissed("u1", "UTC", "browser")).not.toThrow();
  });
});
