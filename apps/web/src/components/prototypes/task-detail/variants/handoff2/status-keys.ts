import type { Status } from "../../types";

/** Letters, not digits: the picker owns 1–4, ← → and R. */
export const STATUS_KEY: Record<Status, string> = {
  todo: "t",
  doing: "p",
  review: "v",
  done: "d",
};
export const OPEN_MENU_KEY = "s";
