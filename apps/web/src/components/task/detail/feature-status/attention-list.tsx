import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/board/avatar";
import type { Held } from "./feature-status";
import { heldCopy } from "./held-copy";
import { ASKED_DOT, BLOCKED_DOT } from "./state-style";

/** Blocked tasks and open requests: what is stuck, why, and who must act. */
export function AttentionList({ held }: { held: Held[] }) {
  const { t } = useTranslation();
  if (held.length === 0) return null;
  return (
    <section aria-label={t("tasks:hero.feature.attention.title")}>
      <h2 className="mb-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
        {t("tasks:hero.feature.attention.title")}
      </h2>
      <ul className="flex flex-col divide-y rounded-2xl border bg-card/60">
        {held.map((h, i) => {
          const copy = heldCopy(t, h);
          return (
            <li
              key={h.task.id}
              className="fs-rise flex items-center gap-3 px-3.5 py-2.5"
              style={{ animationDelay: `${120 + i * 40}ms` }}
            >
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${h.kind === "blocked" ? BLOCKED_DOT : ASKED_DOT}`}
              />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-baseline gap-2 text-sm">
                  <span className="shrink-0 font-mono text-muted-foreground text-xs">
                    {h.task.key}
                  </span>
                  <span className="truncate font-medium">{h.task.title}</span>
                </span>
                <span className="block text-muted-foreground text-xs">
                  {copy.label} · {copy.note}
                </span>
              </span>
              <Avatar person={h.task.assignee} size={22} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
