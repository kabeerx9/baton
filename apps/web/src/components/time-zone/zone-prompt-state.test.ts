import { describe, expect, it } from "vite-plus/test";
import { deriveZonePrompt } from "./zone-prompt-state";

const base = {
  stored: null as string | null | undefined,
  detected: "Asia/Kolkata" as string | null,
  dismissedFor: null as string | null,
  tourCompleted: true as boolean | undefined,
  pathname: "/dashboard/acme",
  now: new Date("2026-11-18T10:00:00Z"),
};
const derive = (patch: Partial<typeof base>) =>
  deriveZonePrompt({ ...base, ...patch });

describe("deriveZonePrompt", () => {
  it("is hidden while the stored zone is unknown", () => {
    expect(derive({ stored: undefined })).toEqual({ kind: "hidden" });
  });

  it("is hidden when the device zone is unknown", () => {
    expect(derive({ detected: null })).toEqual({ kind: "hidden" });
  });

  it("is hidden while the tour is owed or unknown", () => {
    expect(derive({ tourCompleted: false })).toEqual({ kind: "hidden" });
    expect(derive({ tourCompleted: undefined })).toEqual({ kind: "hidden" });
  });

  it("is hidden outside /dashboard/", () => {
    expect(derive({ pathname: "/onboarding" })).toEqual({ kind: "hidden" });
  });

  it("is hidden once dismissed for this device zone", () => {
    expect(derive({ dismissedFor: "Asia/Kolkata" })).toEqual({
      kind: "hidden",
    });
  });

  it("asks again for a different device zone", () => {
    expect(derive({ dismissedFor: "Europe/London" })).toEqual({
      kind: "unset",
      detected: "Asia/Kolkata",
    });
  });

  it("is unset when nothing is stored", () => {
    expect(derive({})).toEqual({ kind: "unset", detected: "Asia/Kolkata" });
  });

  it("is a mismatch when the clocks differ", () => {
    expect(derive({ stored: "Europe/London" })).toEqual({
      kind: "mismatch",
      stored: "Europe/London",
      detected: "Asia/Kolkata",
    });
  });

  it("is hidden when the stored zone is the same clock under another name", () => {
    expect(derive({ stored: "Asia/Calcutta" })).toEqual({ kind: "hidden" });
  });
});
