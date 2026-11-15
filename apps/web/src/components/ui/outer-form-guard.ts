import type * as React from "react";

type GuardedEvent =
  | React.KeyboardEvent<HTMLElement>
  | React.MouseEvent<HTMLElement>;

// A button, or an input that submits when clicked.
const SUBMIT_CONTROL = "button, input[type=submit], input[type=image]";

/**
 * True when the control submits a form that holds the popup and not the popup's
 * own form. A form inside the popup is its own owner and is left alone.
 */
function ownedByOuterForm(target: EventTarget | null, popup: Element): boolean {
  if (
    !(target instanceof HTMLInputElement || target instanceof HTMLButtonElement)
  ) {
    return false;
  }
  // A button's `type` property is "submit" when the attribute is missing.
  if (target instanceof HTMLButtonElement && target.type !== "submit") {
    return false;
  }
  return target.form !== null && !popup.contains(target.form);
}

/**
 * Popup content renders in place, so inside a `<form>` its inputs and buttons
 * have that form as their owner. Base UI portaled it out, so Enter in a search
 * input, a plain `<button>` or an `<input type="submit">` never submitted the
 * form around the popup. Call this from the content's `onKeyDown` and `onClick`
 * to cancel the browser's default action for that case.
 */
export function keepOuterFormUnsubmitted(event: GuardedEvent) {
  if (event.defaultPrevented) return;
  const target =
    "key" in event
      ? event.key === "Enter"
        ? event.target
        : null
      : event.target instanceof Element
        ? event.target.closest(SUBMIT_CONTROL)
        : null;
  if (ownedByOuterForm(target, event.currentTarget)) event.preventDefault();
}
