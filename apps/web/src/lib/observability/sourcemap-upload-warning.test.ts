import { describe, expect, it } from "vite-plus/test";
import { sourcemapUploadWarning } from "./sourcemap-upload-warning";

describe("sourcemapUploadWarning", () => {
  it("is one greppable line with the reason", () => {
    expect(
      sourcemapUploadWarning(new Error("401 Unauthorized\nretry later"), "tok"),
    ).toBe("SENTRY SOURCEMAP UPLOAD FAILED: 401 Unauthorized retry later");
  });

  it("never includes the auth token", () => {
    const line = sourcemapUploadWarning(
      new Error("bad token sntrys_abc123 rejected"),
      "sntrys_abc123",
    );
    expect(line).not.toContain("sntrys_abc123");
    expect(line).toContain("[Filtered]");
  });

  it("handles a non-Error value", () => {
    expect(sourcemapUploadWarning("", undefined)).toBe(
      "SENTRY SOURCEMAP UPLOAD FAILED: unknown error",
    );
  });
});
