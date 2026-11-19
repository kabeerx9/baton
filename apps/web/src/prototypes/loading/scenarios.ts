export type ScenarioId = "fast" | "just-over" | "normal" | "slow" | "error";

export type Scenario = {
  id: ScenarioId;
  label: string;
  /** When the data arrives, in ms after the screen starts loading. */
  resolveAtMs: number;
  outcome: "ok" | "error";
};

export const SCENARIOS: readonly Scenario[] = [
  { id: "fast", label: "Fast 150ms", resolveAtMs: 150, outcome: "ok" },
  {
    id: "just-over",
    label: "Just over 400ms",
    resolveAtMs: 400,
    outcome: "ok",
  },
  { id: "normal", label: "Normal 1.2s", resolveAtMs: 1200, outcome: "ok" },
  { id: "slow", label: "Slow 5s", resolveAtMs: 5000, outcome: "ok" },
  {
    id: "error",
    label: "Error after 1.2s",
    resolveAtMs: 1200,
    outcome: "error",
  },
];

export function scenarioById(id: string | undefined): Scenario {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[2]!;
}
