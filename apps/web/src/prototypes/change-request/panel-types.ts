import type { Action, MockRequest, Phase, Viewer } from "./model";

/** What every variant receives. A variant owns presentation only. */
export type PanelProps = {
  request: MockRequest;
  viewer: Viewer;
  phase: Phase;
  now: number;
  onAction: (action: Action) => void;
  onDismiss: () => void;
};
