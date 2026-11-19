import { DevelopInPage } from "./develop/develop-in-page";
import { DevelopSplash } from "./develop/develop-splash";
import { HandoffInPage } from "./handoff/handoff-in-page";
import { HandoffSplash } from "./handoff/handoff-splash";
import { StatusInPage } from "./status/status-in-page";
import { StatusSplash } from "./status/status-splash";
import type { Variant } from "./variant-types";

export const VARIANTS: readonly Variant[] = [
  {
    label: "Handoff",
    axis: "Brand mark motion on a calm centred splash; the mark is the loading UI",
    Splash: HandoffSplash,
    InPage: HandoffInPage,
  },
  {
    label: "Develop",
    axis: "Structure first: the real layout shows as skeleton shapes and develops into content",
    Splash: DevelopSplash,
    InPage: DevelopInPage,
  },
  {
    label: "Status",
    axis: "Information first: a hairline plus the real awaited step, named in words",
    Splash: StatusSplash,
    InPage: StatusInPage,
  },
];
