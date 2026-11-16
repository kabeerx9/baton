import type { ComponentType } from "react";
import { ConsoleVariant } from "./variants/console/console-variant";
import { HandoffVariant } from "./variants/handoff/handoff-variant";
import { PulseVariant } from "./variants/pulse/pulse-variant";
import type { PageProps } from "./page-props";

export type VariantDef = {
  name: string;
  axis: string;
  Component: ComponentType<PageProps>;
};

export const VARIANTS: readonly VariantDef[] = [
  {
    name: "Handoff",
    axis: "Waiting made visible: a relay of people around one task",
    Component: HandoffVariant,
  },
  {
    name: "Pulse",
    axis: "What happened: a status band over a living timeline",
    Component: PulseVariant,
  },
  {
    name: "Console",
    axis: "Keyboard first: dense properties, command bar, context rail",
    Component: ConsoleVariant,
  },
];
