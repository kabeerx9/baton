import { BIG } from "./scenario-big";
import { DONE } from "./scenario-done";
import { FRESH } from "./scenario-fresh";
import { LINKED } from "./scenario-linked";
import { PLAIN } from "./scenario-plain";
import { SMALL } from "./scenario-small";
import { SCENARIO_IDS, type Scenario, type ScenarioId } from "./scenario-types";

const BY_ID: Record<ScenarioId, Scenario> = {
  big: BIG,
  small: SMALL,
  done: DONE,
  fresh: FRESH,
  linked: LINKED,
  plain: PLAIN,
};

export const SCENARIOS: Scenario[] = SCENARIO_IDS.map((id) => BY_ID[id]);

/** An unknown id falls back to the first scenario. */
export function scenarioById(id: string | null): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!;
}
