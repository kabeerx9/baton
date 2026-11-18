import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { authLinkClassName } from "./auth-link-class";
import type { SignInFooter } from "./auth-methods";

type SignInFooterLineProps = {
  footer: SignInFooter;
  redirect?: string;
  email?: string;
};

export function SignInFooterLine({
  footer,
  redirect,
  email,
}: SignInFooterLineProps) {
  const { t } = useTranslation();

  if (footer === "createAccount") {
    return (
      <p>
        {t("auth:signIn.footer.newHere")}{" "}
        <Link
          to="/auth/sign-up"
          search={{ redirect, email }}
          className={authLinkClassName}
        >
          {t("auth:signIn.footer.createAccount")}
        </Link>
      </p>
    );
  }

  return <p>{t("auth:signIn.footer.inviteOnly")}</p>;
}
