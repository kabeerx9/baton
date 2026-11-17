import { describe, expect, it } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { deriveDemoSnapshot, isDoneMutation } from "./demo-snapshot";
import { demoBoard, TASK_IDS } from "./test-fixtures";

describe("deriveDemoSnapshot", () => {
  it("is pending until the board arrives", () => {
    expect(
      deriveDemoSnapshot({ data: undefined, error: null }, TASK_IDS),
    ).toEqual({ status: "pending" });
  });

  it("reads done and unblocked from the board", () => {
    expect(
      deriveDemoSnapshot({ data: demoBoard(), error: null }, TASK_IDS),
    ).toEqual({
      status: "ready",
      missing: false,
      apiEndpointDone: false,
      writeTestsUnblocked: false,
    });
    expect(
      deriveDemoSnapshot(
        { data: demoBoard({ apiDone: true }), error: null },
        TASK_IDS,
      ),
    ).toMatchObject({ apiEndpointDone: true, writeTestsUnblocked: true });
  });

  it("flags a missing demo task", () => {
    expect(
      deriveDemoSnapshot(
        { data: demoBoard({ without: "write-tests" }), error: null },
        TASK_IDS,
      ),
    ).toMatchObject({ missing: true });
  });

  it.each([403, 404])(
    "treats a %s as a demo workspace that is gone",
    (status) => {
      expect(
        deriveDemoSnapshot(
          { data: undefined, error: new HttpError(status, "nope") },
          TASK_IDS,
        ),
      ).toEqual({ status: "gone" });
    },
  );

  it("stays pending on a server error, which may pass", () => {
    expect(
      deriveDemoSnapshot(
        { data: undefined, error: new HttpError(500, "boom") },
        TASK_IDS,
      ),
    ).toEqual({ status: "pending" });
  });
});

describe("isDoneMutation", () => {
  const write = (outcome: string | undefined, status = "done") => ({
    variables: { taskId: "api", status },
    data: outcome ? { outcome } : undefined,
  });

  it("counts a write that was applied", () => {
    expect(isDoneMutation(write("applied"), "api")).toBe(true);
    expect(
      isDoneMutation(
        {
          variables: { id: "api", status: "done" },
          data: { outcome: "applied" },
        },
        "api",
      ),
    ).toBe(true);
  });

  it("does not count a request, a click that was replaced, or an unknown answer", () => {
    for (const outcome of [
      "requested",
      "superseded",
      "from-the-future",
      undefined,
    ]) {
      expect(isDoneMutation(write(outcome), "api")).toBe(false);
    }
  });

  it("does not count another task or another status", () => {
    expect(isDoneMutation(write("applied"), "other")).toBe(false);
    expect(isDoneMutation(write("applied", "in-progress"), "api")).toBe(false);
  });
});
