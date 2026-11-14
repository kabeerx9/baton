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

/** The toast API callers use: `add`, `update`, `close`. It wraps one UI SDK toaster. */
const toastManager = {
  add: (options: ToastManagerOptions) => toaster(toOptions(options)),
  update: (id: string, options: ToastManagerOptions) =>
    toaster.update(id, toOptions(options)),
  /** Close one toast by id, or every toast without an id. */
  close: (id?: string) => toaster.dismiss(id),
};

export { toaster, toastManager, type ToastManagerOptions };
