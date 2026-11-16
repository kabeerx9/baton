import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

/** Inline link to Settings > Account > Developer, where API keys live. */
export function KeysLink() {
  const { t } = useTranslation();

  return (
    <Link
      to="/dashboard/settings/account/developer"
      className="font-medium text-foreground underline underline-offset-2"
    >
      {t("settings:connectAgent.keysLink")}
    </Link>
  );
}
