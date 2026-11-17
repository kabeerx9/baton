import { describe, expect, it } from "vite-plus/test";
import {
  isKey,
  keyNumber,
  parseTaskRef,
  taskNotFound,
  matchMember,
  matchRepo,
  statusSlug,
} from "./resolve-names";

const members = [
  { id: "u1", name: "Kabeer Joshi", email: "kabeer@x.com" },
  { id: "u2", name: "Aakash", email: "aakash@x.com" },
  { id: "u3", name: "Aakash Verma", email: "av@x.com" },
];
const repos = [
  { id: "p1", name: "App (sfs-native)", slug: "APP", kind: "repo" },
  { id: "p2", name: "API (sfs-django)", slug: "API", kind: "repo" },
  { id: "p3", name: "Board", slug: "T", kind: "board" },
];

describe("matchMember", () => {
  it("finds a person by first name, full name, email or id", () => {
    for (const ref of ["kabeer", "Kabeer Joshi", "KABEER@x.com", "u1"]) {
      expect(matchMember(members, ref)).toMatchObject({
        ok: true,
        value: { id: "u1" },
      });
    }
  });

  it("prefers an exact full name over a shared first name", () => {
    expect(matchMember(members, "Aakash")).toMatchObject({
      ok: true,
      value: { id: "u2" },
    });
  });

  it("refuses a first name two people share, and says what to do", () => {
    const two = members.filter((m) => m.id !== "u2");
    two.push({ id: "u4", name: "Aakash Rao", email: "ar@x.com" });
    const result = matchMember(two, "aakash");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("more than one person");
  });

  it("lists the people when nobody matches", () => {
    const result = matchMember(members, "Rohan");
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.message).toContain("Kabeer Joshi");
  });
});

describe("matchRepo", () => {
  it("finds a repo by id, key, name start, or the repository in brackets", () => {
    for (const ref of ["api", "API", "API (sfs-django)", "sfs-django", "p2"]) {
      expect(matchRepo(repos, ref)).toMatchObject({
        ok: true,
        value: { id: "p2" },
      });
    }
  });

  it("uses the board project when there is no repo", () => {
    for (const ref of [undefined, "none", "No repo", "general"]) {
      expect(matchRepo(repos, ref)).toMatchObject({
        ok: true,
        value: { id: "p3" },
      });
    }
  });

  it("never offers the board project as a repo by name", () => {
    expect(matchRepo(repos, "T").ok).toBe(false);
  });

  it("lists the repos when none matches", () => {
    const result = matchRepo(repos, "web");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("APP (App (sfs-native))");
  });
});

describe("statusSlug and isKey", () => {
  it("turns everyday status words into column slugs", () => {
    expect(statusSlug("In Progress")).toBe("in-progress");
    expect(statusSlug("done")).toBe("done");
    expect(statusSlug("review")).toBe("in-review");
    expect(statusSlug("qa-ready")).toBe("qa-ready");
  });

  it("recognises ticket keys", () => {
    expect(isKey("API-3")).toBe(true);
    expect(isKey("t-12")).toBe(true);
    expect(isKey("Fix the login crash")).toBe(false);
    expect(isKey("3")).toBe(false);
  });
});

describe("keyNumber", () => {
  it("accepts a stored task number and refuses one no task can have", () => {
    expect(keyNumber("3")).toBe(3);
    expect(keyNumber("2147483647")).toBe(2_147_483_647);
    for (const digits of ["0", "2147483648", "99999999999999999999", undefined])
      expect(keyNumber(digits)).toBeNull();
  });
});

describe("parseTaskRef", () => {
  it("splits a key, passes an id through and refuses an impossible number", () => {
    expect(parseTaskRef(" API-3 ")).toEqual({
      key: "API-3",
      slug: "API",
      number: 3,
    });
    expect(parseTaskRef("task-id")).toEqual({ key: "task-id", id: "task-id" });
    let thrown: unknown;
    try {
      parseTaskRef("T-99999999999");
    } catch (error) {
      thrown = error;
    }
    const expected = taskNotFound("T-99999999999");
    expect(thrown).toMatchObject({ status: 404, message: expected.message });
  });
});
