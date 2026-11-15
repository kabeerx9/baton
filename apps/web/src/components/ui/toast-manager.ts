import { createToaster, type ToastType } from "@ui-sdk/react/toast";
import type { ReactNode } from "react";

const toaster = createToaster();

const TOAST_TYPES: readonly ToastType[] = [
  "default",
  "success",
  "error",
  "info",
  "warning",
  "loading",
];

type ToastManagerOptions = {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  type?: string;
  data?: unknown;
  actionProps?: { children?: ReactNode; onClick?: () => void };
};

// An unknown type is a plain toast, not a styled one.
function toToastType(type: string | undefined): ToastType | undefined {
  return TOAST_TYPES.find((known) => known === type);
}

function toOptions(options: ToastManagerOptions) {
  const { actionProps } = options;
  return {
    id: options.id,
    title: options.title,
    description: options.description,
    type: toToastType(options.type),
    data: options.data,
    action: actionProps
      ? { label: actionProps.children, onAction: actionProps.onClick }
      : undefined,
  };
}

// An update changes only the fields it names. UI SDK merges with a spread, so a
// key set to undefined would erase the field: drop the keys the caller left out.
function toPatch(options: ToastManagerOptions) {
  const full = toOptions(options);
  const patch: Partial<typeof full> = {};
  if ("id" in options) patch.id = full.id;
  if ("title" in options) patch.title = full.title;
  if ("description" in options) patch.description = full.description;
  // An explicit undefined or unknown type means default. Leaving it undefined would
  // keep the old type, so a loading toast would never close.
  if ("type" in options) patch.type = full.type ?? "default";
  if ("data" in options) patch.data = full.data;
  if ("actionProps" in options) patch.action = full.action;
  return patch;
}

/** The toast API callers use: `add`, `update`, `close`. It wraps one UI SDK toaster. */
// Unlike Base UI, an update restarts the toast countdown.
const toastManager = {
  add: (options: ToastManagerOptions) => toaster(toOptions(options)),
  update: (id: string, options: ToastManagerOptions) =>
    toaster.update(id, toPatch(options)),
  /** Close one toast by id, or every toast without an id. */
  close: (id?: string) => toaster.dismiss(id),
};

export { toaster, toastManager, type ToastManagerOptions };
