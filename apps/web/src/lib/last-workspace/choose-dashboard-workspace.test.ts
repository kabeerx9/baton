import { describe, expect, it, vi } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { chooseDashboardWorkspace } from "./choose-dashboard-workspace";

const a = { id: "a", kind: "team" };
const b = { id: "b", kind: "team" };
const ok = () => Promise.resolve({});

describe("chooseDashboardWorkspace", () => {
  it("opens the remembered workspace when it still reads", async () => {
    expect(
      await chooseDashboardWorkspace({
        remembered: "b",
        workspaces: [a, b],
        readWorkspace: ok,
      }),
    ).toEqual({ target: { kind: "workspace", id: "b" }, stale: null });
  });

  it("opens the first workspace in a new browser", async () => {
    const readWorkspace = vi.fn(ok);
    expect(
      await chooseDashboardWorkspace({
        remembered: null,
        workspaces: [a, b],
        readWorkspace,
      }),
    ).toEqual({ target: { kind: "workspace", id: "a" }, stale: null });
    expect(readWorkspace).not.toHaveBeenCalled();
  });

  it("drops a refused or archived remembered id for the first one", async () => {
    for (const error of [
      new HttpError(404, "gone"),
      new HttpError(403, "x", { code: "WORKSPACE_ARCHIVED" }),
    ])
      expect(
        await chooseDashboardWorkspace({
          remembered: "gone",
          workspaces: [b],
          readWorkspace: () => Promise.reject(error),
        }),
      ).toEqual({ target: { kind: "workspace", id: "b" }, stale: "gone" });
  });

  it("goes to onboarding when nothing is left", async () => {
    expect(
      await chooseDashboardWorkspace({
        remembered: "gone",
        workspaces: [],
        readWorkspace: () => Promise.reject(new HttpError(403, "no")),
      }),
    ).toEqual({ target: { kind: "onboarding" }, stale: "gone" });
  });

  it("throws, never guesses, when the read fails for another reason", async () => {
    await expect(
      chooseDashboardWorkspace({
        remembered: "b",
        workspaces: [a, b],
        readWorkspace: () => Promise.reject(new HttpError(500, "boom")),
      }),
    ).rejects.toMatchObject({ status: 500 });
  });
});
