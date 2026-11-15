import { Link } from "@tanstack/react-router";

/** Inline link to Settings > Account > Developer, where API keys live. */
export function KeysLink() {
  return (
    <Link
      to="/dashboard/settings/account/developer"
      className="font-medium text-foreground underline underline-offset-2"
    >
      Create one in Developer settings
    </Link>
  );
}
