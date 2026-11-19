import type { PageId } from "./copy";
import { SCENARIOS, type ScenarioId } from "./scenarios";

export type ScreenId = "splash" | "page";
export type ThemeId = "light" | "dark";

export type LoadingSearch = {
  v?: number;
  screen?: ScreenId;
  page?: PageId;
  s?: ScenarioId;
  theme?: ThemeId;
  /** Freeze the clock at this many ms, for screenshots. */
  at?: number;
  /** 0 hides the harness controls, for screenshots. */
  chrome?: 0;
};

export function parseLoadingSearch(
  raw: Record<string, unknown>,
): LoadingSearch {
  const num = (value: unknown) => {
    const n = typeof value === "string" ? Number(value) : value;
    return typeof n === "number" && Number.isFinite(n) ? n : undefined;
  };
  const v = num(raw.v);
  const at = num(raw.at);
  return {
    v: v !== undefined && v >= 1 && v <= 3 ? Math.floor(v) : undefined,
    screen:
      raw.screen === "splash" || raw.screen === "page" ? raw.screen : undefined,
    page: raw.page === "task" || raw.page === "board" ? raw.page : undefined,
    s: SCENARIOS.find((scenario) => scenario.id === raw.s)?.id,
    theme:
      raw.theme === "light" || raw.theme === "dark" ? raw.theme : undefined,
    at: at !== undefined && at >= 0 ? at : undefined,
    chrome: num(raw.chrome) === 0 ? 0 : undefined,
  };
}
