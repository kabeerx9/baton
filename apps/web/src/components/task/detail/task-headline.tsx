import { useTranslation } from "react-i18next";
import type { Headline } from "./headline-model";

/** The headline as a sentence. Each case has its own static key. */
export function TaskHeadline({
  headline,
  owner,
}: {
  headline: Headline;
  owner: string | null;
}) {
  const { t } = useTranslation();
  switch (headline.kind) {
    case "unknown":
      return <>{t("tasks:hero.headline.unknown")}</>;
    case "done":
      return headline.released > 0 ? (
        <>
          {t("tasks:hero.headline.doneReleased", { count: headline.released })}
        </>
      ) : (
        <>{t("tasks:hero.headline.done")}</>
      );
    case "request":
      return <>{t("tasks:hero.headline.request")}</>;
    case "waiting":
      return (
        <>
          {t("tasks:hero.headline.waiting", {
            count: headline.count,
            keys: headline.keys,
          })}
        </>
      );
    case "ready":
      return owner ? (
        <>{t("tasks:hero.headline.readyOwned", { name: owner })}</>
      ) : (
        <>{t("tasks:hero.headline.readyUnowned")}</>
      );
  }
}
