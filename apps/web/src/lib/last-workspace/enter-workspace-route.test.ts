import { describe, expect, it } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { enterWorkspaceRoute } from "./enter-workspace-route";

const failWith = (error: unknown) => () => Promise.reject(error);

describe("enterWorkspaceRoute", () => {
  it("is ready when the workspace reads", async () => {
    expect(await enterWorkspaceRoute(() => Promise.resolve({}))).toEqual({
      status: "ready",
    });
  });

  it("keeps an archived workspace on its own screen", async () => {
    const archived = new HttpError(403, "x", { code: "WORKSPACE_ARCHIVED" });
    expect(await enterWorkspaceRoute(failWith(archived))).toEqual({
      status: "archived",
    });
  });

  it("refuses a workspace the user cannot read", async () => {
    for (const status of [403, 404])
      expect(
        await enterWorkspaceRoute(failWith(new HttpError(status, "no"))),
      ).toEqual({ status: "refused" });
  });

  it("fails, never ready, on any other error", async () => {
    const error = new HttpError(500, "boom");
    expect(await enterWorkspaceRoute(failWith(error))).toEqual({
      status: "failed",
      error,
    });
  });
});
