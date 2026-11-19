import { useCallback, useEffect, useState } from "react";
import "./loading.css";
import { HarnessControls } from "./harness-controls";
import { useLoadView } from "./use-load-view";
import { scenarioById, type ScenarioId } from "./scenarios";
import type { LoadingSearch, ScreenId, ThemeId } from "./search";
import type { PageId } from "./copy";
import { VariantPicker } from "./variant-picker";
import { VARIANTS } from "./variants";

type LoadingPrototypeProps = {
  search: LoadingSearch;
  onSearch: (patch: Partial<LoadingSearch>) => void;
};

function systemTheme(): ThemeId {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Drive the app's own theme class, as ThemeProvider does, then restore it. */
function useForcedTheme(theme: ThemeId | undefined) {
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    const before = ["light", "dark"].filter((c) => root.classList.contains(c));
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    return () => {
      root.classList.remove("light", "dark");
      root.classList.add(...before);
    };
  }, [theme]);
}

export function LoadingPrototype({ search, onSearch }: LoadingPrototypeProps) {
  const variantIndex = (search.v ?? 1) - 1;
  const screen: ScreenId = search.screen ?? "splash";
  const page: PageId = search.page ?? "task";
  const scenario = scenarioById(search.s);
  const [theme, setTheme] = useState<ThemeId>(
    () => search.theme ?? systemTheme(),
  );
  const [replays, setReplays] = useState(0);
  useForcedTheme(theme);

  // Switching anything re-mounts the stage and restarts the clock.
  const runKey = `${variantIndex}-${screen}-${page}-${replays}`;
  const view = useLoadView(scenario, runKey, search.at);

  const replay = useCallback(() => setReplays((n) => n + 1), []);
  const select = useCallback(
    (index: number) => onSearch({ v: index + 1 }),
    [onSearch],
  );

  const variant = VARIANTS[variantIndex] ?? VARIANTS[0]!;
  const Stage = screen === "splash" ? variant.Splash : variant.InPage;

  return (
    <div
      className="h-svh w-full"
      data-variant={variant.label}
      data-theme-forced={theme}
    >
      <Stage key={runKey} view={view} page={page} onRetry={replay} />
      {search.chrome === 0 ? null : (
        <HarnessControls
          screen={screen}
          page={page}
          scenarioId={scenario.id}
          theme={theme}
          viewKind={view.kind}
          onScreen={(id) => onSearch({ screen: id })}
          onPage={(id) => onSearch({ page: id })}
          onScenario={(id: ScenarioId) => onSearch({ s: id })}
          onTheme={setTheme}
        />
      )}
      <VariantPicker
        labels={VARIANTS.map((v) => v.label)}
        current={variantIndex}
        onSelect={select}
        onReplay={replay}
      />
    </div>
  );
}
