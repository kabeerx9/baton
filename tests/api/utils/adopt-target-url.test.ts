import { Client } from "pg";
import { describe, expect, it } from "vite-plus/test";
import { refuseAmbiguousTarget } from "../../../apps/api/scripts/adopt-migration-baseline/check-target-url";

describe("refuseAmbiguousTarget", () => {
  it("refuses query parameters that move the connection elsewhere", () => {
    // Reproduction from review: pg connects to 127.0.0.1:32771 although the
    // URL names shown.invalid:1.
    const url =
      "postgresql://postgres:secret@shown.invalid:1/followup_review_test?host=127.0.0.1&port=32771";
    const client = new Client({ connectionString: url });
    expect([client.host, client.port]).toEqual(["127.0.0.1", 32771]);
    expect(refuseAmbiguousTarget(url)).toMatch(/\?host, \?port/);
  });

  it.each([
    "postgresql://u:p@db.example:5432/baton?dbname=other",
    "postgresql://u:p@db.example:5432/baton?hostaddr=10.0.0.1",
    "postgresql://u:p@db.example:5432/baton?service=prod",
    "postgresql://u:p@/baton",
    "postgresql://u:p@db.example:5432",
    "postgresql://u:p@db.example:5432/",
    "not a url",
  ])("refuses %s", (url) => {
    expect(refuseAmbiguousTarget(url)).not.toBeNull();
  });

  it("accepts a URL that names its host and database, as pg resolves it", () => {
    const url = "postgresql://u:p@127.0.0.1:55439/baton?sslmode=disable";
    const client = new Client({ connectionString: url });
    expect(refuseAmbiguousTarget(url)).toBeNull();
    expect([client.host, client.port, client.database]).toEqual([
      "127.0.0.1",
      55439,
      "baton",
    ]);
  });
});
