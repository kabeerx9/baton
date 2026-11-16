import { createFileRoute } from "@tanstack/react-router";
import { TourPrototype } from "@/prototypes/tour/harness";

// Prototype surface for the product tour picker. Deleted once a variant is picked.
export const Route = createFileRoute("/prototypes/tour")({
  component: TourPrototype,
});
