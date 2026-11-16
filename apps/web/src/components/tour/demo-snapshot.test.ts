import { describe, expect, it } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { deriveDemoSnapshot } from "./demo-snapshot";
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
