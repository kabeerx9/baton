import { createContext, useContext } from "react";
import type { BonePhase } from "./bone-phase";

export const BoneContext = createContext<BonePhase>("content");

export function useBonePhase(): BonePhase {
  return useContext(BoneContext);
}
