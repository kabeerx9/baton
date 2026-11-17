import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import updateTaskStatus from "./update-task-status";

const mocks = vi.hoisted(() => ({ put: vi.fn() }));

vi.mock("@baton/libs", () => ({
  client: { task: { status: { ":id": { $put: mocks.put } } } },
}));

beforeEach(() => {
  mocks.put.mockReset();
  mocks.put.mockResolvedValue({ ok: true, json: async () => ({}) });
});

describe("updateTaskStatus", () => {
  it("hands the deadline to the request, as Hono's request init", async () => {
    const signal = AbortSignal.timeout(1000);
    await updateTaskStatus("t", { status: "done" }, signal);
    expect(mocks.put).toHaveBeenCalledWith(
      { param: { id: "t" }, json: { status: "done" } },
      { init: { signal } },
    );
  });

  it("throws the server's answer for a refusal", async () => {
    mocks.put.mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({ message: "Blocked" }),
    });
    await expect(
      updateTaskStatus("t", { status: "done" }),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
