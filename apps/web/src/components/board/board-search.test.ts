import { describe, expect, it } from "vite-plus/test";
import { boardSearchSchema, searchFor, viewOf } from "./board-search";

describe("boardSearchSchema", () => {
  it("reads view=mine", () => {
    expect(viewOf(boardSearchSchema.parse({ view: "mine" }))).toBe("mine");
  });
  it("reads a missing view as all", () => {
    expect(viewOf(boardSearchSchema.parse({}))).toBe("all");
  });
  it("reads an unknown view as all", () => {
    expect(viewOf(boardSearchSchema.parse({ view: "everything" }))).toBe("all");
    expect(viewOf(boardSearchSchema.parse({ view: 3 }))).toBe("all");
  });
  it("leaves view out of the URL for all", () => {
    expect(searchFor("all")).toEqual({});
    expect(searchFor("mine")).toEqual({ view: "mine" });
  });
});
