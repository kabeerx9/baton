import { describe, expect, it } from "vite-plus/test";
import { pickActiveWorkspace } from "./pick-active-workspace";

const a = { id: "a", kind: "team" };
const b = { id: "b", kind: "team" };
const demo = { id: "d", kind: "demo" };

describe("pickActiveWorkspace", () => {
  it("lets a route id win over everything, even one not in the list", () => {
    expect(pickActiveWorkspace("x", "b", [a, b])).toEqual({
      kind: "route",
      id: "x",
    });
  });

  it("uses the remembered id when there is no route id", () => {
    expect(pickActiveWorkspace(undefined, "b", [a, b])).toEqual({
      kind: "remembered",
      id: "b",
    });
  });

  it("keeps a remembered id that the list leaves out (the tour's demo)", () => {
    expect(pickActiveWorkspace(undefined, "d", [a])).toEqual({
      kind: "remembered",
      id: "d",
    });
  });

  it("falls back to the first team workspace", () => {
    expect(pickActiveWorkspace(undefined, null, [demo, b, a])).toEqual({
      kind: "first",
      id: "b",
    });
  });

  it("answers none when nothing is left", () => {
    expect(pickActiveWorkspace(undefined, undefined, [])).toEqual({
      kind: "none",
    });
    expect(pickActiveWorkspace(undefined, null, [demo])).toEqual({
      kind: "none",
    });
  });
});
