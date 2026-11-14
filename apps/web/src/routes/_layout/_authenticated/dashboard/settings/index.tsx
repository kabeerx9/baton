import { createFileRoute, redirect } from "@tanstack/react-router";

// Settings is a shell with no page of its own. Open the first page instead of
// leaving an empty frame.
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/",
)({
  beforeLoad: () => {
    throw redirect({
      to: "/dashboard/settings/account/information",
      replace: true,
    });
  },
});
