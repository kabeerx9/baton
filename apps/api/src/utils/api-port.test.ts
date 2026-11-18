import { describe, expect, it } from "vite-plus/test";
import { resolveApiPort } from "./api-port";

describe("resolveApiPort", () => {
  it("defaults to 1337", () => {
    expect(resolveApiPort(undefined)).toBe(1337);
    expect(resolveApiPort("  ")).toBe(1337);
  });

  it("uses BATON_API_PORT when set", () => {
    expect(resolveApiPort("1447")).toBe(1447);
  });

  it("refuses a value that is not a port", () => {
    for (const raw of ["abc", "0", "70000", "13.5"]) {
      expect(() => resolveApiPort(raw)).toThrow(/BATON_API_PORT/);
    }
  });
});
