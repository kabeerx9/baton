import { cn } from "@/lib/cn";
import { PAGE_LABEL, type PageId } from "./copy";
import { SCENARIOS, type ScenarioId } from "./scenarios";
import type { ScreenId, ThemeId } from "./search";

type Option<T extends string> = { id: T; label: string };

function Group<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 gap-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
          className={cn(
            "h-6 rounded-md px-2 text-xs whitespace-nowrap text-neutral-300 transition-colors duration-150 ease-out hover:text-white",
            option.id === value && "bg-white/15 text-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const SCREENS: readonly Option<ScreenId>[] = [
  { id: "splash", label: "Splash" },
  { id: "page", label: "In-page" },
];
const PAGES: readonly Option<PageId>[] = (["task", "board"] as const).map(
  (id) => ({ id, label: PAGE_LABEL[id] }),
);
const THEMES: readonly Option<ThemeId>[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

type HarnessControlsProps = {
  screen: ScreenId;
  page: PageId;
  scenarioId: ScenarioId;
  theme: ThemeId;
  viewKind: string;
  onScreen: (id: ScreenId) => void;
  onPage: (id: PageId) => void;
  onScenario: (id: ScenarioId) => void;
  onTheme: (id: ThemeId) => void;
};

/** Harness chrome: scenario, screen and theme. Not part of any variant. */
export function HarnessControls(props: HarnessControlsProps) {
  return (
    <div
      data-harness-controls
      className="fixed inset-x-2 top-2 z-[2147483646] mx-auto flex max-w-fit items-center gap-3 overflow-x-auto rounded-full bg-neutral-950/85 px-3 py-1 font-sans text-neutral-300 shadow-lg backdrop-blur"
    >
      <Group
        label="Screen"
        options={SCREENS}
        value={props.screen}
        onChange={props.onScreen}
      />
      {props.screen === "page" ? (
        <Group
          label="Page"
          options={PAGES}
          value={props.page}
          onChange={props.onPage}
        />
      ) : null}
      <Group
        label="Scenario"
        options={SCENARIOS.map((s) => ({ id: s.id, label: s.label }))}
        value={props.scenarioId}
        onChange={props.onScenario}
      />
      <Group
        label="Theme"
        options={THEMES}
        value={props.theme}
        onChange={props.onTheme}
      />
      <span
        className="shrink-0 font-mono text-[11px] text-neutral-500"
        data-testid="view-kind"
      >
        {props.viewKind}
      </span>
    </div>
  );
}
