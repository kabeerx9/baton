/** A column of the project, as the status bar needs it. */
export type StatusColumn = {
  id: string;
  slug: string;
  name: string;
  position: number;
  isFinal: boolean;
  icon?: string | null;
};

export type StatusStep = {
  slug: string;
  name: string;
  isFinal: boolean;
  icon: string | null;
  /** Finishing is refused while the task waits on an open task. */
  locked: boolean;
};

/**
 * What the bar shows. One value, derived from the project's columns and the
 * task's stored status. A status no column knows is never shown as active.
 */
export type StatusBarState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; steps: StatusStep[]; current: string; index: number }
  | { kind: "unknown"; steps: StatusStep[]; stored: string };

export function deriveStatusBar({
  columns,
  status,
  blocked,
  loading,
  failed,
}: {
  columns: readonly StatusColumn[] | undefined;
  status: string | null | undefined;
  /** An open task holds this one up: final steps are locked. */
  blocked: boolean;
  loading: boolean;
  failed: boolean;
}): StatusBarState {
  if (!columns) return failed ? { kind: "unavailable" } : { kind: "loading" };
  if (columns.length === 0)
    return loading ? { kind: "loading" } : { kind: "unavailable" };

  const steps: StatusStep[] = [...columns]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      isFinal: c.isFinal,
      icon: c.icon ?? null,
      locked: blocked && c.isFinal,
    }));
  const stored = status ?? "";
  // The API stores the slug; an older row may hold the column id.
  const matched = columns.find((c) => c.slug === stored || c.id === stored);
  if (!matched) return { kind: "unknown", steps, stored };
  const index = steps.findIndex((s) => s.slug === matched.slug);
  return { kind: "ready", steps, current: matched.slug, index };
}
