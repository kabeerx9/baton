import type { ComponentType } from "react";
import type { PageId } from "./copy";
import type { LoadView } from "./load-view";

export type VariantProps = {
  view: LoadView;
  page: PageId;
  onRetry: () => void;
};

export type Variant = {
  label: string;
  /** The one phrase this direction explores. */
  axis: string;
  /** Boot, session, workspace and permissions: nothing can show yet. */
  Splash: ComponentType<VariantProps>;
  /** The shell is known, the data is not. */
  InPage: ComponentType<VariantProps>;
};
