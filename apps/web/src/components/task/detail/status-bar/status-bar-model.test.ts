import { describe, expect, it } from "vite-plus/test";
import { deriveStatusBar, type StatusColumn } from "./status-bar-model";

const col = (
  slug: string,
  position: number,
  isFinal = false,
): StatusColumn => ({
  id: `id-${slug}`,
  slug,
  name: slug,
  position,
  isFinal,
});
const cols = [
  col("done", 3, true),
  col("to-do", 0),
  col("in-progress", 1),
  col("qa", 2),
];
const base = { blocked: false, loading: false, failed: false };

describe("deriveStatusBar", () => {
  it("orders steps by position and marks the current one", () => {
    const s = deriveStatusBar({ ...base, columns: cols, status: "qa" });
    expect(s.kind).toBe("ready");
    if (s.kind === "ready") {
      expect(s.steps.map((x) => x.slug)).toEqual([
        "to-do",
        "in-progress",
        "qa",
        "done",
      ]);
      expect(s.current).toBe("qa");
      expect(s.index).toBe(2);
    }
  });

  it("treats a status no column knows as unknown, with nothing active", () => {
    const s = deriveStatusBar({ ...base, columns: cols, status: "archived" });
    expect(s.kind).toBe("unknown");
    expect(s).not.toHaveProperty("current");
  });

  it("treats a missing status as unknown", () => {
    expect(deriveStatusBar({ ...base, columns: cols, status: null }).kind).toBe(
      "unknown",
    );
  });

  it("locks final steps while blocked", () => {
    const s = deriveStatusBar({
      ...base,
      blocked: true,
      columns: cols,
      status: "to-do",
    });
    expect(
      s.kind === "ready" && s.steps.filter((x) => x.locked).map((x) => x.slug),
    ).toEqual(["done"]);
  });

  it("is loading before columns arrive and unavailable when they fail", () => {
    expect(
      deriveStatusBar({
        ...base,
        columns: undefined,
        status: "to-do",
        loading: true,
      }).kind,
    ).toBe("loading");
    expect(
      deriveStatusBar({
        ...base,
        columns: undefined,
        status: "to-do",
        failed: true,
      }).kind,
    ).toBe("unavailable");
  });
});
