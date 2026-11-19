import { createFileRoute } from "@tanstack/react-router";
import { LegacyInvitationPage } from "@/components/join/legacy-invitation-page";

// An old e-mailed invitation path, like /invitation/abc123. The token cannot
// be redeemed: e-mail invitations were replaced by join links. No data call.
export const Route = createFileRoute("/invitation/$token")({
  component: LegacyInvitationPage,
});
