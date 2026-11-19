import { describe, expect, it } from "vite-plus/test";
import { privacyOptions } from "./sentry-options";

// The real hook, on spans shaped as the SDK hands them to beforeSendSpan.
const send = (attributes: Record<string, unknown>, name = "span") =>
  privacyOptions.beforeSendSpan({
    trace_id: "t",
    span_id: "s",
    name,
    start_timestamp: 0,
    status: "error",
    is_segment: false,
    attributes,
  });

describe("beforeSendSpan", () => {
  it("gives a database span a fixed segment name", () => {
    const span = send({
      "sentry.op": "db",
      "sentry.segment.name": "import Secret plan rows",
      "sentry.segment.id": "seg1",
    });
    expect(span.attributes).toMatchObject({
      "sentry.segment.name": "database",
      "sentry.segment.id": "seg1",
    });
  });

  it("replaces a free-text status message on any span", () => {
    const span = send({
      "sentry.op": "http.client",
      "sentry.status.message": "request failed for Secret plan",
    });
    expect(span.attributes?.["sentry.status.message"]).toBe("internal_error");
  });

  it("keeps a standard status and a database span's fixed message", () => {
    expect(
      send({ "sentry.op": "http.client", "sentry.status.message": "not_found" })
        .attributes?.["sentry.status.message"],
    ).toBe("not_found");
    expect(
      send({ "sentry.op": "db", "sentry.status.message": "bad Secret plan" })
        .attributes?.["sentry.status.message"],
    ).toBe("database error");
  });
});
