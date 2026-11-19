import { useTranslation } from "react-i18next";
import { HandoffMark } from "./handoff-mark";
import "./splash.css";
import { type SplashStep, splashLineKey } from "./splash-step";

/**
 * Full-screen splash for a moment when nothing can show yet: app icon,
 * wordmark, the baton, and one line that says what the app waits on.
 */
export function SplashScreen({ step }: { step: SplashStep }) {
  const { t } = useTranslation();
  return (
    <div className="splash-enter flex h-svh w-full flex-col items-center justify-center bg-background px-6">
      <img
        alt=""
        className="size-20 rounded-[22px] shadow-sm ring-1 ring-black/10 sm:size-24 sm:rounded-[26px] dark:ring-white/10"
        src="/favicon.svg"
      />
      <p className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {t("common:appName")}
      </p>
      <div className="mt-10 sm:mt-12">
        <HandoffMark />
      </div>
      <div
        aria-live="polite"
        className="mt-8 flex w-full max-w-xs flex-col items-center gap-1"
        role="status"
      >
        <p className="text-base text-foreground/80">{t(splashLineKey(step))}</p>
        <p className="splash-reassure min-h-5 text-sm text-muted-foreground">
          {t("common:splash.stillWorking")}
        </p>
      </div>
    </div>
  );
}
