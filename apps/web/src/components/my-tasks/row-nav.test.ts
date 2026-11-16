import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  focusedTaskId,
  focusNeighbour,
  moveRowFocus,
  nextIndex,
} from "./row-nav";

function mount(ids: string[]) {
  const scope = document.createElement("div");
  scope.innerHTML = ids
    .map(
      (id) =>
        `<div data-task-id="${id}"><a href="#" data-row-focus>${id}</a></div>`,
    )
    .join("");
  document.body.append(scope);
  return scope;
}
const focused = () => document.activeElement?.textContent;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("nextIndex", () => {
  it("enters the list at the near end when nothing is focused", () => {
    expect(nextIndex(-1, 1, 5)).toBe(0);
    expect(nextIndex(-1, -1, 5)).toBe(4);
  });

  it("stops at the ends instead of wrapping", () => {
    expect(nextIndex(4, 1, 5)).toBe(4);
    expect(nextIndex(0, -1, 5)).toBe(0);
    expect(nextIndex(2, 1, 5)).toBe(3);
    expect(nextIndex(-1, 1, 0)).toBe(-1);
  });
});

describe("row focus", () => {
  it("moves down and up the rows and reports the focused task", () => {
    const scope = mount(["a", "b", "c"]);
    expect(focusedTaskId(scope)).toBeNull();
    moveRowFocus(scope, 1);
    moveRowFocus(scope, 1);
    expect(focused()).toBe("b");
    expect(focusedTaskId(scope)).toBe("b");
    moveRowFocus(scope, -1);
    expect(focusedTaskId(scope)).toBe("a");
  });

  it("hands focus to the next row before a row leaves, or the one before at the end", () => {
    const scope = mount(["a", "b", "c"]);
    moveRowFocus(scope, 1);
    focusNeighbour(scope);
    expect(focused()).toBe("b");
    moveRowFocus(scope, 1);
    focusNeighbour(scope);
    expect(focused()).toBe("b");
  });

  it("ignores focus outside its scope", () => {
    const scope = mount(["a"]);
    const other = mount(["z"]);
    moveRowFocus(other, 1);
    expect(focusedTaskId(scope)).toBeNull();
  });
});
