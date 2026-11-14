import { createParts } from "@ui-sdk/react/primitive";
import { boardNav } from "./board-nav";

/** The board's keyboard parts: a root, a frame around each card, the card link. */
export const BoardNav = createParts(boardNav, {
  root: "div",
  frame: "article",
  card: "a",
});
