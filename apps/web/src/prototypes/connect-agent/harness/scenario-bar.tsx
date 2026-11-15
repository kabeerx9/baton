import { MoonIcon, SunIcon } from "lucide-react";
import { SCENARIOS, type Scenario } from "../types";
import "./picker.css";

type ScenarioBarProps = {
  scenario: Scenario;
  onScenario: (scenario: Scenario) => void;
  dark: boolean;
  onToggleTheme: () => void;
};

/** Harness chrome: switches the fixture scenario and the theme. */
export function ScenarioBar({
  scenario,
  onScenario,
  dark,
  onToggleTheme,
}: ScenarioBarProps) {
  return (
    <div className="proto-bar" role="group" aria-label="Prototype controls">
      <select
        aria-label="Scenario"
        value={scenario}
        onChange={(e) => onScenario(e.target.value as Scenario)}
      >
        {SCENARIOS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
        onClick={onToggleTheme}
      >
        {dark ? (
          <SunIcon size={14} aria-hidden="true" />
        ) : (
          <MoonIcon size={14} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
