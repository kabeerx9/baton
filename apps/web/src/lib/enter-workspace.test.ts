import { describe, expect, it, vi } from "vite-plus/test";
import { enterWorkspace } from "./enter-workspace";

const run = (
  sessionActiveId: string | undefined,
  setActive: (id: string) => Promise<unknown>,
) =>
  enterWorkspace({
    workspaceId: "B",
    sessionActiveId,
    setActive: setActive as never,
  });

describe("enterWorkspace", () => {
  it("does nothing when the session already matches the URL", async () => {
    const setActive = vi.fn();
    expect(await run("B", setActive)).toEqual({ status: "ready" });
    expect(setActive).not.toHaveBeenCalled();
  });

  it("activates the URL workspace when the session names another", async () => {
    const setActive = vi.fn().mockResolvedValue({ data: {} });
    expect(await run("A", setActive)).toEqual({ status: "ready" });
    expect(setActive).toHaveBeenCalledWith("B");
  });

  it("activates when the session has no active workspace", async () => {
    const setActive = vi.fn().mockResolvedValue({ data: {} });
    await run(undefined, setActive);
    expect(setActive).toHaveBeenCalledWith("B");
  });

  it("lets an archived workspace show its own screen", async () => {
    const setActive = vi.fn().mockResolvedValue({
      error: { status: 403, code: "WORKSPACE_ARCHIVED" },
    });
    expect(await run("A", setActive)).toEqual({ status: "ready" });
  });

  it("reports a non-member", async () => {
    const setActive = vi.fn().mockResolvedValue({
      error: { status: 403, code: "USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION" },
    });
    expect(await run("A", setActive)).toEqual({ status: "not-member" });
  });

  it("fails, never ready, when setActive errors", async () => {
    const error = { status: 429 };
    expect(await run("A", vi.fn().mockResolvedValue({ error }))).toEqual({
      status: "failed",
      error,
    });
    const thrown = new Error("network");
    expect(await run("A", vi.fn().mockRejectedValue(thrown))).toEqual({
      status: "failed",
      error: thrown,
    });
  });
});
