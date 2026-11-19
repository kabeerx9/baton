import { SCENARIOS } from "./scenarios";
import type { ScenarioId } from "./scenario-types";

/** Prototype chrome, not part of any variant: pick a scenario, flip the theme. */
export function HarnessControls({
  scenario,
  onScenario,
  dark,
  onToggleTheme,
}: {
  scenario: ScenarioId;
  onScenario: (id: ScenarioId) => void;
  dark: boolean;
  onToggleTheme: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 pt-4 text-sm sm:px-6">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-muted-foreground">
        <span className="shrink-0">Scenario</span>
        <select
          value={scenario}
          onChange={(e) => onScenario(e.target.value as ScenarioId)}
          className="min-w-0 flex-1 rounded-lg border bg-card px-2 py-1.5 text-foreground"
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onToggleTheme}
        className="shrink-0 rounded-lg border bg-card px-3 py-1.5 text-muted-foreground transition-transform duration-150 ease-out active:scale-[0.97]"
      >
        {dark ? "Light" : "Dark"}
      </button>
    </div>
  );
}
