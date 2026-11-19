import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { digestConfigWarnings, slackConfig } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("slack digest config", () => {
  it("reads SLACK_DIGEST_TIME and SLACK_DIGEST_TZ", () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
    vi.stubEnv("SLACK_DIGEST_TIME", "09:30");
    vi.stubEnv("SLACK_DIGEST_TZ", "America/New_York");
    expect(slackConfig()).toMatchObject({
      digestTime: { hour: 9, minute: 30 },
      digestTimezone: "America/New_York",
    });
    expect(digestConfigWarnings()).toEqual([]);
  });

  it("falls back to 10:00 in Asia/Kolkata and warns about each bad value", () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
    vi.stubEnv("SLACK_DIGEST_TIME", "9:30");
    vi.stubEnv("SLACK_DIGEST_TZ", "IST");
    expect(slackConfig()).toMatchObject({
      digestTime: { hour: 10, minute: 0 },
      digestTimezone: "Asia/Kolkata",
    });
    const warnings = digestConfigWarnings();
    expect(warnings).toHaveLength(2);
    expect(warnings.join("\n")).toMatch(/SLACK_DIGEST_TIME "9:30"/);
    expect(warnings.join("\n")).toMatch(/SLACK_DIGEST_TZ "IST"/);
  });
});
