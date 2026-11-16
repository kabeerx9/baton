import { useTranslation } from "react-i18next";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import { getColumnIcon } from "@/lib/column";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";
import type { StatusBarState } from "./status-bar-model";

/**
 * The status bar, drawn. It owns no state: the model says which step is
 * current, and `onChoose` asks the caller to write. Arrow keys only move focus.
 */
export function StatusBarView({
  state,
  pending,
  onChoose,
}: {
  state: StatusBarState;
  pending: boolean;
  onChoose: (slug: string) => void;
}) {
  const { t } = useTranslation();
  if (state.kind === "loading")
    return (
      <p className="h-12 rounded-xl bg-muted/50 px-3 py-3 text-muted-foreground text-sm">
        {t("tasks:hero.status.loading")}
      </p>
    );
  if (state.kind === "unavailable")
    return (
      <p
        role="alert"
        className="rounded-xl border border-border px-3 py-3 text-muted-foreground text-sm"
      >
        {t("tasks:hero.status.unavailable")}
      </p>
    );

  const current = state.kind === "ready" ? state.current : null;
  // The `s` shortcut clicks this target; with nothing checked, the first step.
  const target = current ?? state.steps[0]?.slug;
  return (
    <div>
      <SegmentedControl
        aria-label={t("tasks:hero.status.label")}
        value={current}
        disabled={pending}
        onChoose={onChoose}
        className="overflow-x-auto"
      >
        {state.steps.map((step) => (
          <SegmentedControlItem
            key={step.slug}
            value={step.slug}
            disabled={step.locked}
            title={step.locked ? t("tasks:hero.status.locked") : undefined}
            data-task-action={step.slug === target ? "status" : undefined}
            className="min-w-28 shrink-0 sm:min-w-0 sm:shrink"
          >
            {getColumnIcon(step.slug, step.isFinal, step.icon)}
            <span className="truncate">
              {getStatusDisplayLabel(step.slug, step.name)}
            </span>
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <p
        className="mt-2 text-muted-foreground text-xs"
        role={state.kind === "unknown" ? "status" : undefined}
      >
        {state.kind === "unknown"
          ? t("tasks:hero.status.unknown")
          : t("tasks:hero.status.hint")}
      </p>
    </div>
  );
}
