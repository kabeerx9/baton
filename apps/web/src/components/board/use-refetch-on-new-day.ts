import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

/**
 * The server cuts the Done column at the cutoff the client sent. When the
 * local day changes, that cutoff is a day old: refetch every board read, with
 * the new one. Mounted once, by the board, so it runs once per change.
 */
export function useRefetchOnNewDay(day: number) {
  const queryClient = useQueryClient();
  const seen = useRef(day);
  useEffect(() => {
    if (seen.current === day) return;
    seen.current = day;
    void queryClient.invalidateQueries({ queryKey: ["task-board"] });
  }, [day, queryClient]);
}
