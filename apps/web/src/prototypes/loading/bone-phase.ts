import type { LoadView } from "./load-view";

/** What a placeholder box (`Bone`) should render. */
export type BonePhase = "bones" | "handoff" | "reveal" | "content";

export function bonePhase(view: LoadView): BonePhase {
  switch (view.kind) {
    case "quiet":
    case "loading":
      return "bones";
    case "handoff":
      return view.wasShown ? "handoff" : "reveal";
    case "done":
    case "failed":
      return "content";
    default:
      return "bones";
  }
}
