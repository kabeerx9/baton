import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";

/** The app's fallback when no route matches. */
export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageTitle title={t("common:notFound.title")} />
      <div className="flex min-h-svh w-full flex-col items-center justify-center gap-4 bg-background px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">{t("common:notFound.title")}</h1>
        <p className="max-w-md text-muted-foreground">
          {t("common:notFound.description")}
        </p>
        <Button variant="outline" render={<Link to="/dashboard" />}>
          {t("common:notFound.home")}
        </Button>
      </div>
    </>
  );
}

export default NotFoundPage;
