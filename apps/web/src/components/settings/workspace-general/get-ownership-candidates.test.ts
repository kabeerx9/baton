import { describe, expect, it } from "vite-plus/test";
import { getOwnershipCandidates } from "./get-ownership-candidates";

const members = [
  { id: "u1", role: "owner" },
  { id: "u2", role: "admin" },
  { id: "u3", role: "member" },
];

describe("getOwnershipCandidates", () => {
  it("finds the owner and everyone else as candidates", () => {
    const result = getOwnershipCandidates(members, "u1");
    expect(result.currentOwner?.id).toBe("u1");
    expect(result.eligibleNewOwners.map((member) => member.id)).toEqual([
      "u2",
      "u3",
    ]);
  });

  it("never offers the current user", () => {
    const result = getOwnershipCandidates(members, "u2");
    expect(result.eligibleNewOwners.map((member) => member.id)).toEqual(["u3"]);
  });

  it("returns no candidates for a workspace with only the owner", () => {
    expect(
      getOwnershipCandidates([members[0]], "u1").eligibleNewOwners,
    ).toEqual([]);
  });
});
