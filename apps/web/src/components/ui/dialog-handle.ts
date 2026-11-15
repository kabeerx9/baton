import {
  createDialogController,
  type DialogController,
} from "@ui-sdk/react/dialog";

// Kept free of the i18n bundle that `dialog.tsx` loads for its close button, so
// the command palette can share the factory without a load-order dependency.

/**
 * What `DialogCreateHandle()` returns. It keeps the Base UI handle API
 * (`open(triggerId)`, `openWithPayload(payload)`, `close()`, `isOpen`) over a
 * UI SDK controller, so a caller passes it as `handle` to the dialog and to
 * detached triggers.
 */
type DialogHandle<Payload = unknown> = {
  readonly controller: DialogController<Payload>;
  /** Opens the dialog from the detached trigger with this id. */
  open: (triggerId: string) => void;
  openWithPayload: (payload: Payload) => void;
  close: () => void;
  readonly isOpen: boolean;
  /** Trigger payloads by id, kept so `open(triggerId)` can pass one. */
  readonly triggers: Map<string, Payload | undefined>;
};

function DialogCreateHandle<Payload = unknown>(): DialogHandle<Payload> {
  const controller = createDialogController<Payload>();
  const triggers = new Map<string, Payload | undefined>();
  return {
    controller,
    triggers,
    open(triggerId) {
      void controller.open({ payload: triggers.get(triggerId) });
    },
    openWithPayload(payload) {
      void controller.open({ payload });
    },
    close() {
      controller.close();
    },
    get isOpen() {
      return Boolean(controller.isOpen());
    },
  };
}

export { DialogCreateHandle };
export type { DialogHandle };
