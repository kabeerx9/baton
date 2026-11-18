// Shapes copied from the join-link contract (§3). The typed client does not
// know these routes until the backend merges; keep these in step with the API.

export type JoinLinkState = "active" | "expired" | "used_up";

export type JoinLink = {
  id: string;
  state: JoinLinkState;
  /** Non-null only while active and decryptable. */
  url: string | null;
  expiresAt: string;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  maxUses: number | null;
  useCount: number;
};

export type JoinLinkExpiry = "30m" | "24h" | "7d";

export type CreateJoinLinkInput = {
  expiresIn?: JoinLinkExpiry;
  maxUses?: number | null;
};

export type JoinLinkUnavailableReason =
  | "expired"
  | "revoked"
  | "used_up"
  | "not_found";

export type JoinLinkPreview =
  | {
      status: "active";
      workspace: { name: string };
      sharedBy: { name: string } | null;
      expiresAt: string;
    }
  | { status: "unavailable"; reason: JoinLinkUnavailableReason };

export type JoinOutcome = "joined" | "already_member";

export type JoinWorkspaceResult = {
  outcome: JoinOutcome;
  workspace: { id: string; slug: string; name: string };
};
