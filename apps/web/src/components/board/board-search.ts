import { z } from "zod/v4";
import type { BoardView } from "./filter-mine";

/**
 * The board's URL search. `view=mine` is the only value written; "all" is the
 * default and is left out of the URL. Anything else reads as "all".
 */
export const boardSearchSchema = z.object({
  view: z.literal("mine").optional().catch(undefined),
});

export type BoardSearch = z.infer<typeof boardSearchSchema>;

export function viewOf(search: BoardSearch): BoardView {
  return search.view === "mine" ? "mine" : "all";
}

/** The search for a view: "all" drops the param. */
export function searchFor(view: BoardView): BoardSearch {
  return view === "mine" ? { view: "mine" } : {};
}
