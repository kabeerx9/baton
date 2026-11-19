import { describe, expect, it } from "vite-plus/test";
import { scrubRecordingEvent, scrubReplayEvent } from "./scrub-recording-event";

describe("scrubRecordingEvent", () => {
  it("scrubs the page URL in a meta event", () => {
    const event = scrubRecordingEvent({
      type: 4,
      timestamp: 1,
      data: {
        href: "https://app.test/join/joinSecret123",
        width: 1,
        height: 1,
      },
    });
    expect(JSON.stringify(event)).not.toContain("joinSecret123");
    expect(event.data).toMatchObject({ width: 1 });
  });

  it("scrubs navigation breadcrumbs in a custom event", () => {
    const event = scrubRecordingEvent({
      type: 5,
      data: {
        tag: "breadcrumb",
        payload: {
          category: "navigation",
          data: { to: "/auth/reset-password?token=resetSecret" },
        },
      },
    });
    expect(JSON.stringify(event)).not.toContain("resetSecret");
  });

  it("leaves DOM snapshot events untouched", () => {
    const event = { type: 2, data: { node: { text: "/join/x" } } };
    expect(scrubRecordingEvent(event)).toBe(event);
  });
});

describe("scrubReplayEvent", () => {
  it("scrubs the page URLs of a replay event", () => {
    const event = scrubReplayEvent({
      type: "replay_event",
      urls: [
        "https://app.test/join/joinSecret1",
        "https://app.test/x?token=t1",
      ],
      request: { url: "https://app.test/join/joinSecret1" },
    });
    expect(JSON.stringify(event)).not.toMatch(/joinSecret1|t1"/);
  });

  it("passes other events through unchanged", () => {
    const event = { type: "transaction", urls: ["/join/x"] };
    expect(scrubReplayEvent(event)).toBe(event);
  });
});
