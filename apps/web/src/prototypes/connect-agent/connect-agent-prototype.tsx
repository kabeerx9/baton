import { useCallback, useState } from "react";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { Picker } from "./harness/picker";
import { PrototypeFrame } from "./harness/prototype-frame";
import { ScenarioBar } from "./harness/scenario-bar";
import type { Scenario } from "./types";
import { FocusVariant } from "./variants/focus-variant";
import { LedgerVariant } from "./variants/ledger-variant";
import { StepsVariant } from "./variants/steps-variant";

const VARIANTS = [
  { name: "Focus", Component: FocusVariant },
  { name: "Ledger", Component: LedgerVariant },
  { name: "Guided", Component: StepsVariant },
] as const;

const NAMES = VARIANTS.map((v) => v.name);

type PrototypeProps = {
  /** Zero-based index from the `v` search param. */
  variant: number;
  scenario: Scenario;
  onVariant: (index: number) => void;
  onScenario: (scenario: Scenario) => void;
};

export function ConnectAgentPrototype({
  variant,
  scenario,
  onVariant,
  onScenario,
}: PrototypeProps) {
  // Switching or replaying bumps the key, so the variant re-mounts and its entrance runs again.
  const [epoch, setEpoch] = useState(0);
  const theme = useUserPreferencesStore((s) => s.theme);
  const setTheme = useUserPreferencesStore((s) => s.setTheme);
  const dark = theme !== "light";

  const select = useCallback(
    (index: number) => {
      onVariant(index);
      setEpoch((e) => e + 1);
    },
    [onVariant],
  );
  const replay = useCallback(() => setEpoch((e) => e + 1), []);

  const { Component } = VARIANTS[variant] ?? VARIANTS[0];

  return (
    <>
      <PrototypeFrame>
        <Component
          key={`${variant}-${scenario}-${epoch}`}
          scenario={scenario}
        />
      </PrototypeFrame>
      <ScenarioBar
        scenario={scenario}
        onScenario={onScenario}
        dark={dark}
        onToggleTheme={() => setTheme(dark ? "light" : "dark")}
      />
      <Picker
        names={NAMES}
        current={variant}
        onSelect={select}
        onReplay={replay}
      />
    </>
  );
}
