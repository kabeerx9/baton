import * as React from "react";

// UI SDK renders popup content in place, so a React event from inside it also
// reaches any onClick on the component that holds the popup: a board card
// link, a menu item, a sortable row. Only these events are contained. Keys are
// not: Escape, the shortcut registry and a form's submit key listen on
// document, and stopping a key at the popup would break them.
const CONTAINED = [
  "onClick",
  "onDoubleClick",
  "onContextMenu",
  "onPointerDown",
  "onMouseDown",
  "onSubmit",
  "onReset",
] as const;

// One warning per element: a mark retried on every click would flood the
// console, and an element that is remounted is a new case worth reporting.
const warned = new WeakSet<Element>();

/**
 * Warns when the element sits inside `<a href>`, `<button>` or `<label>`.
 * Containment cannot fix that: the browser runs the ancestor's default action
 * whatever propagation does, so the usage needs `container`. A grep cannot see
 * nesting that comes from composition (a feature renders the popup inside a
 * Link the wrapper never mentions); this can.
 */
function warnIfNativelyNested(element: Element) {
  if (!import.meta.env.DEV || warned.has(element)) return;
  warned.add(element);

  const ancestor = element.parentElement?.closest("a[href], button, label");
  if (!ancestor) return;

  console.error(
    `[popup-containment] popup content sits inside <${ancestor.tagName.toLowerCase()}>. ` +
      "A click in it runs that element's default action; pass container={document.body} on this usage.",
  );
}

/** The contained handlers for one element. The caller's handler runs first. */
function containedHandlers(
  source: Record<string, unknown>,
): Record<string, unknown> {
  const handlers: Record<string, unknown> = {};
  for (const name of CONTAINED) {
    const own = source[name];
    const call =
      typeof own === "function"
        ? (own as (event: React.SyntheticEvent) => void)
        : undefined;
    handlers[name] = (event: React.SyntheticEvent) => {
      call?.(event);
      warnIfNativelyNested(event.currentTarget);
      event.stopPropagation();
    };
  }
  return handlers;
}

/**
 * Props for a popup content or backdrop part. The caller's handler runs first,
 * then containment, so an opt-out composition cannot skip it: this is not
 * built with `mergeProps`, where a `preventDefault()` would.
 *
 * A `render` element needs the same wrapper. UI SDK merges its handlers after
 * the part's props: they run first, and one that calls `preventDefault()`
 * skips the part's handler. Containment on the props alone would then never
 * run, and `render={<div onClick={(event) => event.preventDefault()} />}`
 * would leak. So the element is cloned with the same contained handlers, and
 * every wrapper gets both cases by passing its props through here once.
 *
 * A `render` function gets the part's props and must spread them; its returned
 * element's own handlers are not merged, so there it needs its own containment.
 *
 * `data-popup` marks the subtree for `isFromPopup`.
 */
export function containPopupEvents<P extends Record<string, unknown>>(
  props: P,
  enabled = true,
): P {
  const next: Record<string, unknown> = { ...props, "data-popup": "" };
  if (!enabled) return next as P;

  Object.assign(next, containedHandlers(props));

  const render = props.render;
  if (React.isValidElement<Record<string, unknown>>(render)) {
    next.render = React.cloneElement(render, containedHandlers(render.props));
  }
  return next as P;
}

/**
 * True when the event started in a popup that this element holds. Keys still
 * bubble out of a popup, so an ancestor that acts on keys guards itself with
 * this instead of with containment.
 */
export function isFromPopup(event: {
  target: EventTarget | null;
  currentTarget: EventTarget | null;
}) {
  if (!(event.target instanceof Element)) return false;
  if (!(event.currentTarget instanceof Node)) return false;
  const popup = event.target.closest("[data-popup]");
  return popup !== null && !popup.contains(event.currentTarget);
}
