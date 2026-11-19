import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { authLinkClassName } from "@/components/auth/auth-link-class";
import { AuthPage } from "@/components/auth/auth-page";
import PageTitle from "@/components/page-title";

/**
 * Emailed invitation links from before join links land here. No data call: the
 * token cannot be redeemed, so the page only explains what to do instead.
 */
export function LegacyInvitationPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageTitle title={t("joinLink:legacyInvite.title")} />
      <AuthPage
        title={t("joinLink:legacyInvite.title")}
        description={t("joinLink:legacyInvite.description")}
      >
        <p className="text-muted-foreground text-sm">
          <Link to="/dashboard" className={authLinkClassName}>
            {t("joinLink:page.goToBaton")}
          </Link>
        </p>
      </AuthPage>
    </>
  );
}

export default LegacyInvitationPage;
