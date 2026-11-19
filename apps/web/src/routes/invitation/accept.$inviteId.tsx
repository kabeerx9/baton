import { createFileRoute } from "@tanstack/react-router";
import { LegacyInvitationPage } from "@/components/join/legacy-invitation-page";

// Emailed invitation links from before join links land here. No data call.
export const Route = createFileRoute("/invitation/accept/$inviteId")({
  component: LegacyInvitationPage,
});
