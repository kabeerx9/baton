import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ClosedAnimation } from "@/components/auth/closed-animation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

// Shown on /auth/sign-up when registration is closed and there is no invitation.
export function RegistrationClosed() {
  const { t } = useTranslation();
  return (
    <main className="flex h-svh w-full flex-col items-center justify-center gap-6 overflow-y-auto bg-muted/40 px-6 py-12 text-center">
      {/* Light backdrop keeps the cat's dark tail visible in dark theme. */}
      <div className="flex size-72 max-w-full items-center justify-center rounded-full bg-white/90 p-8">
        <ClosedAnimation />
      </div>
      <Badge variant="info" size="lg">
        {t("auth:signUp.closed.badge")}
      </Badge>
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="font-semibold text-3xl tracking-[-0.02em]">
          {t("auth:signUp.closed.title")}
        </h1>
        <p className="text-muted-foreground">{t("auth:signUp.closed.body")}</p>
      </div>
      <Link
        to="/auth/sign-in"
        className={buttonVariants({ variant: "outline" })}
      >
        {t("auth:signUp.toggleLink")}
      </Link>
    </main>
  );
}
