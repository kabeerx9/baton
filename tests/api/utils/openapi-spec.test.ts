import { describe, expect, it } from "vite-plus/test";
import { normalizeApiServerUrl } from "../../../apps/api/src/utils/openapi-spec";

describe("normalizeApiServerUrl", () => {
  it("appends /api when the base has no api suffix", () => {
    expect(normalizeApiServerUrl("https://baton.example.com")).toBe(
      "https://baton.example.com/api",
    );
  });

  it("leaves a URL that already ends with /api alone", () => {
    expect(normalizeApiServerUrl("https://baton.example.com/api")).toBe(
      "https://baton.example.com/api",
    );
  });

  it("strips trailing slashes before appending", () => {
    expect(normalizeApiServerUrl("https://baton.example.com///")).toBe(
      "https://baton.example.com/api",
    );
    expect(normalizeApiServerUrl("https://baton.example.com/api/")).toBe(
      "https://baton.example.com/api",
    );
  });
});
