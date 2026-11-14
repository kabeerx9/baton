import { createFileRoute } from "@tanstack/react-router";
import { ChangeRequestHarness } from "@/prototypes/change-request/harness";

// Prototype only. Public on purpose so it renders without a session. Delete on promotion.
export const Route = createFileRoute("/prototypes/change-request")({
  component: ChangeRequestHarness,
});
