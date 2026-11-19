import { createFileRoute } from "@tanstack/react-router";
import { FeatureStatusPrototype } from "@/prototypes/feature-status/harness";

// Prototype surface for the feature status area. Deleted once a variant is picked.
export const Route = createFileRoute("/prototypes/feature-status")({
  component: FeatureStatusPrototype,
});
