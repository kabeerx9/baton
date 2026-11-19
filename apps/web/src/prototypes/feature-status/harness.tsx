import { useCallback, useEffect, useMemo, useState } from "react";
import { summarizeFeature } from "./feature-status";
import { HarnessControls } from "./harness-controls";
import { MotionStyles } from "./motion-styles";
import { Picker } from "./picker";
import { PlainTaskHero } from "./plain-task-hero";
import { scenarioById } from "./scenarios";
import type { ScenarioId } from "./scenario-types";
import { StreamStandIn } from "./stream-stand-in";
import { VARIANTS } from "./variants";

function param(name: string) {
  return new URLSearchParams(location.search).get(name);
}

function writeParam(name: string, value: string) {
  const url = new URL(location.href);
  url.searchParams.set(name, value);
  history.replaceState(null, "", url);
}

function initialVariant() {
  const v = Number.parseInt(param("v") ?? "", 10);
  return v >= 1 && v <= VARIANTS.length ? v - 1 : 0;
}

/**
 * Prototype surface for the feature status area. Nothing in production imports
 * it. The picker flips the variant, the select flips the scenario, and both
 * live in the URL (?v=2&s=big).
 */
export function FeatureStatusPrototype() {
  const [variant, setVariant] = useState(initialVariant);
  const [scenarioId, setScenarioId] = useState<ScenarioId>(
    () => scenarioById(param("s")).id,
  );
  const [epoch, setEpoch] = useState(0);
  const [dark, setDark] = useState(
    () =>
      param("theme") === "dark" ||
      (param("theme") === null &&
        document.documentElement.classList.contains("dark")),
  );

  useEffect(() => {
    if (param("theme") === null && dark === isDarkNow()) return;
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(dark ? "dark" : "light");
  }, [dark]);

  const select = useCallback((i: number) => {
    setVariant(i);
    setEpoch((e) => e + 1);
    writeParam("v", String(i + 1));
  }, []);
  const replay = useCallback(() => setEpoch((e) => e + 1), []);
  const chooseScenario = useCallback((id: ScenarioId) => {
    setScenarioId(id);
    setEpoch((e) => e + 1);
    writeParam("s", id);
  }, []);

  const scenario = scenarioById(scenarioId);
  const summary = useMemo(
    () => summarizeFeature(scenario.feature, scenario),
    [scenario],
  );
  const { Component } = VARIANTS[variant] ?? VARIANTS[0]!;
  const isPlain = scenario.feature.subtasks.length === 0;

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background text-foreground">
      <MotionStyles />
      <HarnessControls
        scenario={scenarioId}
        onScenario={chooseScenario}
        dark={dark}
        onToggleTheme={() => setDark((d) => !d)}
      />
      <main
        key={`${variant}-${scenarioId}-${epoch}`}
        className="mx-auto w-full max-w-6xl px-4 pt-4 pb-28 sm:px-6"
      >
        {isPlain ? (
          <PlainTaskHero scenario={scenario} />
        ) : (
          <Component scenario={scenario} summary={summary} />
        )}
        <StreamStandIn count={scenario.feature.subtasks.length || 1} />
      </main>
      <Picker
        names={VARIANTS.map((v) => v.name)}
        current={variant}
        onSelect={select}
        onReplay={replay}
      />
    </div>
  );
}

function isDarkNow() {
  return document.documentElement.classList.contains("dark");
}
