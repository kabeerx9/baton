import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/board/avatar";
import type { Person } from "@/components/board/model";
import type { CoreTone } from "./diagram/diagram-core";
import { TONE_STYLE } from "./hero-tone";

/**
 * The top of the task page: key, title, one sentence, the status bar and the
 * dependency diagram. It lays them out; the page decides what they say.
 */
export function TaskHero({
  tone,
  keyLabel,
  repoName,
  title,
  headline,
  bar,
  diagram,
  owner,
  signal,
  children,
}: {
  tone: CoreTone;
  keyLabel: string;
  repoName: string | null;
  title: ReactNode;
  headline: ReactNode;
  bar: ReactNode;
  diagram: ReactNode;
  owner: Person | null;
  /** A short pill under the circle: blocked, or a pending request. */
  signal: string | null;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const style = TONE_STYLE[tone];
  return (
    <section
      className={`relative overflow-hidden rounded-3xl border bg-card ${style.border}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b ${style.glow} to-transparent`}
        aria-hidden="true"
      />
      <div className="relative px-5 pt-6 pb-6 sm:px-8 sm:pt-7">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-foreground">
            {keyLabel}
          </span>
          {repoName && <span className="truncate">{repoName}</span>}
        </div>
        <div className="mt-3 max-w-3xl">{title}</div>
        <p
          className={`mt-2 flex items-center gap-1.5 font-medium text-sm ${style.text}`}
        >
          <span
            className={`size-1.5 shrink-0 rounded-full ${style.dot}`}
            aria-hidden="true"
          />
          {headline}
        </p>
        <div className="mt-5">{bar}</div>
        {diagram}
        <div className="mt-5 flex flex-col items-center gap-2 md:mt-6">
          {signal && (
            <span
              className={`rounded-full bg-muted px-2.5 py-1 font-medium text-xs ${style.text}`}
            >
              {signal}
            </span>
          )}
          <span className="inline-flex items-center gap-2 text-muted-foreground text-sm">
            <Avatar person={owner} size={22} />
            {owner
              ? t("tasks:hero.owner.ownedBy", { name: owner.name })
              : t("tasks:hero.owner.unowned")}
          </span>
        </div>
        {children}
      </div>
    </section>
  );
}
