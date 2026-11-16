import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import type { PrototypeSearch } from "./task-detail-prototype";

/** Merge into the prototype's URL search, so a screenshot run can script it. */
export function useSearchSetter() {
  const navigate = useNavigate();
  return useCallback(
    (next: Partial<PrototypeSearch>) =>
      void navigate({
        to: "/prototypes/task-detail",
        search: (prev: PrototypeSearch) => ({ ...prev, ...next }),
        replace: true,
      }),
    [navigate],
  );
}
