type OwnershipMember = {
  /** The member's user id (flat API shape). */
  id: string;
  role: string;
};

export function getOwnershipCandidates<T extends OwnershipMember>(
  members: T[],
  currentUserId: string | undefined,
) {
  return {
    currentOwner: members.find((member) => member.role === "owner"),
    eligibleNewOwners: members.filter(
      (member) => member.role !== "owner" && member.id !== currentUserId,
    ),
  };
}
