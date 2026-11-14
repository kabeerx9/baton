import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vite-plus/test";

// Vitest runs without globals, so Testing Library cannot register its own
// cleanup. Unmounted trees matter more with UI SDK: popups live in the top layer
// and keep focus and state across tests.
afterEach(cleanup);

// Node can expose an incomplete global localStorage when it is launched with
// --localstorage-file but no usable path. Because that property takes
// precedence over jsdom's implementation, tests then receive an object without
// the Storage methods. Install a small in-memory implementation only in that
// broken environment.
if (typeof globalThis.localStorage?.clear !== "function") {
  const values = new Map<string, string>();
  const localStorage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorage,
  });
}

// UI SDK reports development warnings as errors in tests.
declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

// jsdom stubs for UI SDK popups (node_modules/@ui-sdk/core/skills/ui-sdk/
// references/testing.md). Assigned, not `??=`: jsdom has some of these without
// the parts that matter.
HTMLElement.prototype.showPopover = function () {};
HTMLElement.prototype.hidePopover = function () {};
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = function () {};
Element.prototype.checkVisibility = () => true;
Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
document.elementFromPoint = () => null;
document.elementsFromPoint = () => [];
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
document.head.append(
  Object.assign(document.createElement("style"), {
    textContent: "[popover] { display: block !important }",
  }),
);
