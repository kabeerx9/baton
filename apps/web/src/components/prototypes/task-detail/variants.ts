import type { ComponentType } from "react";
import {
  HandoffActionVariant,
  HandoffBarVariant,
  HandoffNodeVariant,
} from "./variants/handoff2/handoff2-variants";
import { HandoffVariant } from "./variants/handoff/handoff-variant";
import type { PageProps } from "./page-props";

export type VariantDef = {
  name: string;
  axis: string;
  Component: ComponentType<PageProps>;
};

export const VARIANTS: readonly VariantDef[] = [
  {
    name: "Handoff v1",
    axis: "The original: status lives in the properties column",
    Component: HandoffVariant,
  },
  {
    name: "Handoff: node",
    axis: "The circle is the status control",
    Component: HandoffNodeVariant,
  },
  {
    name: "Handoff: bar",
    axis: "A full-width segmented status bar under the title",
    Component: HandoffBarVariant,
  },
  {
    name: "Handoff: action",
    axis: "A changing primary button plus a status dropdown",
    Component: HandoffActionVariant,
  },
];
