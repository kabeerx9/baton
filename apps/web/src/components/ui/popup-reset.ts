// UI SDK popups render in place, so they inherit text styles from the element
// they sit in (a card title, a muted label, a truncated cell). Put this first in
// every popup content class so the popup starts from the app's body text.
// Base UI popups render in a portal under <body> and did not need it.
export const POPUP_RESET =
  "text-base font-normal leading-normal tracking-normal whitespace-normal text-start normal-case text-popover-foreground";
