import { describe, expect, it } from "vite-plus/test";
import {
  assertLocalTestServer,
  scratchDatabaseName,
} from "./scratch-database-name";

describe("assertLocalTestServer", () => {
  it.each([
    "postgres://u:p@localhost:5432/baton_test",
    "postgres://u:p@127.0.0.1:55471/baton_test",
    "postgres://u:p@[::1]:5432/baton_test",
  ])("accepts %s", (url) => {
    expect(() => assertLocalTestServer(url)).not.toThrow();
  });

  it.each([
    "postgres://u:p@db.example.supabase.co:5432/baton_test",
    "postgres://u:p@10.0.0.5:5432/baton_test",
  ])("refuses a remote host: %s", (url) => {
    expect(() => assertLocalTestServer(url)).toThrow(/localhost/);
  });

  it("refuses a database that is not a _test one", () => {
    expect(() =>
      assertLocalTestServer("postgres://u:p@localhost:5432/baton"),
    ).toThrow(/_test/);
  });
});

describe("scratchDatabaseName", () => {
  it("gives a new _test name on every call", () => {
    const first = scratchDatabaseName("auth_boundary");
    expect(first).toMatch(/^baton_auth_boundary_[0-9a-f]{12}_test$/);
    expect(scratchDatabaseName("auth_boundary")).not.toBe(first);
  });

  it("refuses a label that would need quoting", () => {
    expect(() => scratchDatabaseName('x"; DROP DATABASE y; --')).toThrow();
  });
});
