import { describe, expect, it } from "vite-plus/test";
import { normalizeRoleToken } from "./normalize-role-token";

describe("role token normalization", () => {
  it.each([
    [" member, owner ", "member,owner"],
    [["member", "\towner\n"], "member,owner"],
    [["member, owner", "member"], "member,owner"],
    [" member , recruiter,member,,", "member,recruiter"],
  ])("normalizes valid provider role shapes (%j)", (input, expected) => {
    expect(normalizeRoleToken(input)).toBe(expected);
  });

  it.each(
    [null, undefined, 1, {}, ["member", 1], [["owner"]]].map((role) => ({
      role,
    })),
  )("leaves invalid shapes for provider validation ($role)", ({ role }) => {
    expect(normalizeRoleToken(role)).toBeUndefined();
  });
});
